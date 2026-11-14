//! Converte partituras MuseScore em XML (.mscx) para o `hinario.json` do app.
//! Uso: mscx2json --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json
//!
//! Cada arquivo deve se chamar `hino-<número>.mscx`. O tempo sai em batidas
//! (semínima = 1) e as notas em MIDI, como descrito em docs/FORMATO.md.

use roxmltree::{Document, Node};
use serde_json::{Map, Value, json};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub struct Evento {
    pub inicio: f64,
    pub dur: f64,
    pub midi: u8,
}

#[derive(Debug)]
pub struct Voz {
    pub nome: String,
    pub notas: Vec<Evento>,
}

#[derive(Debug)]
pub struct Hino {
    pub numero: u32,
    pub titulo: String,
    pub autoria: Option<String>,
    pub andamento: Option<u32>,
    pub vozes: Vec<Voz>,
    pub letra: Vec<String>,
    pub avisos: Vec<String>,
}

fn filho<'a, 'i>(n: Node<'a, 'i>, nome: &str) -> Option<Node<'a, 'i>> {
    n.children().find(|c| c.is_element() && c.tag_name().name() == nome)
}

fn texto<'a, 'i>(n: Node<'a, 'i>, nome: &str) -> Option<&'a str> {
    filho(n, nome).and_then(|c| c.text()).map(str::trim)
}

fn numero<T: std::str::FromStr>(n: Node, nome: &str) -> Option<T> {
    texto(n, nome).and_then(|s| s.parse().ok())
}

/// "3/4" -> batidas (semínima = 1).
fn fracao(s: &str) -> Option<f64> {
    let (a, b) = s.split_once('/')?;
    let (a, b): (f64, f64) = (a.trim().parse().ok()?, b.trim().parse().ok()?);
    (b != 0.0).then(|| a / b * 4.0)
}

fn batidas_do_tipo(t: &str) -> Option<f64> {
    Some(match t {
        "long" => 16.0,
        "breve" => 8.0,
        "whole" => 4.0,
        "half" => 2.0,
        "quarter" => 1.0,
        "eighth" => 0.5,
        "16th" => 0.25,
        "32nd" => 0.125,
        "64th" => 0.0625,
        "128th" => 0.03125,
        _ => return None,
    })
}

fn duracao(n: Node, compasso: f64) -> Result<f64, String> {
    let tipo = texto(n, "durationType").ok_or("nota ou pausa sem <durationType>")?;
    if tipo == "measure" {
        return Ok(texto(n, "duration").and_then(fracao).unwrap_or(compasso));
    }
    let base = batidas_do_tipo(tipo).ok_or_else(|| format!("durationType desconhecido: {tipo}"))?;
    let pontos: i32 = numero(n, "dots").unwrap_or(0);
    Ok(base * (2.0 - 0.5f64.powi(pontos)))
}

fn e_apojatura(chord: Node) -> bool {
    chord.children().any(|c| {
        let nome = c.tag_name().name();
        c.is_element() && (nome.starts_with("grace") || nome == "acciaccatura" || nome == "appoggiatura")
    })
}

fn liga_inicio(nota: Node) -> bool {
    nota.children().any(|c| {
        c.is_element()
            && match c.tag_name().name() {
                "Spanner" => c.attribute("type") == Some("Tie") && filho(c, "next").is_some(),
                "Tie" => true,
                _ => false,
            }
    })
}

fn liga_fim(nota: Node) -> bool {
    nota.children().any(|c| {
        c.is_element()
            && match c.tag_name().name() {
                "Spanner" => c.attribute("type") == Some("Tie") && filho(c, "prev").is_some(),
                "endTie" => true,
                _ => false,
            }
    })
}

/// Um acorde lido da partitura: notas como (midi, termina_ligadura, começa_ligadura).
struct Acorde {
    inicio: f64,
    dur: f64,
    notas: Vec<(u8, bool, bool)>,
}

#[derive(Default)]
struct Trilha {
    notas: Vec<Evento>,
    /// Notas ligadas esperando continuação: (midi, índice em `notas`).
    pendentes: Vec<(u8, usize)>,
}

/// Sílaba da letra com o instante (em batidas) da nota a que pertence.
struct Silaba {
    t: f64,
    voz: usize,
    verso: u32,
    continua: bool, // "begin"/"middle": a palavra segue na próxima sílaba
    texto: String,
}

struct Estado<'a> {
    andamento: Option<u32>,
    tuplos: Vec<f64>,
    compasso: f64,
    /// MuseScore 2: vozes soltas no compasso, separadas por <tick> e <track>.
    plano: bool,
    /// Voz de quem está sendo lido (ignorado quando `plano`).
    voz_base: usize,
    /// Ticks por semínima (<Division>).
    divisao: f64,
    /// Acordes por voz da pauta atual.
    saida: &'a mut BTreeMap<usize, Vec<Acorde>>,
    /// Sílabas e respirações (instantes) da pauta atual.
    silabas: &'a mut Vec<Silaba>,
    respiracoes: &'a mut Vec<f64>,
}

fn voz_do(c: Node, est: &Estado) -> usize {
    if est.plano {
        numero::<usize>(c, "track").map_or(0, |t| t % 4)
    } else {
        est.voz_base
    }
}

fn percorrer(no: Node, t: &mut f64, est: &mut Estado) -> Result<(), String> {
    for c in no.children().filter(|c| c.is_element()) {
        match c.tag_name().name() {
            "Tempo" if est.andamento.is_none() => {
                if let Some(v) = numero::<f64>(c, "tempo") {
                    est.andamento = Some((v * 60.0).round() as u32);
                }
            }
            "Tuplet" => {
                let normal: f64 = numero(c, "normalNotes").unwrap_or(2.0);
                let real: f64 = numero(c, "actualNotes").unwrap_or(3.0);
                est.tuplos.push(normal / real);
                // Formato aninhado: os acordes ficam dentro de <Tuplet>.
                if c.children().any(|x| x.has_tag_name("Chord") || x.has_tag_name("Rest")) {
                    percorrer(c, t, est)?;
                    est.tuplos.pop();
                }
            }
            "tick" if est.plano => {
                if let Some(v) = c.text().and_then(|x| x.trim().parse::<f64>().ok()) {
                    *t = v / est.divisao;
                }
            }
            "Breath" => est.respiracoes.push(*t),
            "endTuplet" => {
                est.tuplos.pop();
            }
            "Rest" => *t += duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>(),
            "Chord" => {
                if e_apojatura(c) {
                    continue;
                }
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                let mut notas = vec![];
                for nota in c.children().filter(|n| n.has_tag_name("Note")) {
                    if texto(nota, "play") == Some("0") {
                        continue;
                    }
                    let midi: u8 = numero(nota, "pitch").ok_or("nota sem <pitch> válido")?;
                    notas.push((midi, liga_fim(nota), liga_inicio(nota)));
                }
                let voz = voz_do(c, est);
                for l in c.children().filter(|x| x.has_tag_name("Lyrics")) {
                    let sil = texto(l, "text").map(str::trim).filter(|t| !t.is_empty());
                    if let Some(sil) = sil {
                        est.silabas.push(Silaba {
                            t: *t,
                            voz,
                            verso: numero(l, "no").unwrap_or(0),
                            continua: matches!(texto(l, "syllabic"), Some("begin" | "middle")),
                            texto: sil.to_string(),
                        });
                    }
                }
                if !notas.is_empty() {
                    est.saida.entry(voz).or_default().push(Acorde { inicio: *t, dur, notas });
                }
                *t += dur;
            }
            _ => {}
        }
    }
    Ok(())
}

fn registrar(tr: &mut Trilha, inicio: f64, dur: f64, midi: u8, fim_liga: bool, ini_liga: bool) {
    if fim_liga {
        if let Some(i) = tr.pendentes.iter().position(|(m, _)| *m == midi) {
            let (_, idx) = tr.pendentes.remove(i);
            tr.notas[idx].dur += dur;
            if ini_liga {
                tr.pendentes.push((midi, idx));
            }
            return;
        }
    }
    tr.notas.push(Evento { inicio, dur, midi });
    if ini_liga {
        tr.pendentes.push((midi, tr.notas.len() - 1));
    }
}

/// Junta as camadas de uma pauta e separa em vozes pela altura das notas que soam juntas:
/// a mais aguda é a voz 1, a mais grave a última. Se só uma nota soa, ela é repetida nas
/// demais vozes (uníssono). Uma nota longa continua sendo uma nota só enquanto ficar na
/// mesma voz. Com `limite`, nos trechos com mais notas que vozes ficam a mais aguda, a mais
/// grave e (se couberem) as intermediárias mais próximas; devolve também quantos trechos
/// tiveram notas omitidas.
fn dividir_em_vozes(camadas: Vec<Vec<Acorde>>, limite: Option<usize>) -> (Vec<Vec<Evento>>, usize) {
    let mut eventos: Vec<Evento> = vec![];
    for acordes in camadas {
        let mut tr = Trilha::default();
        for a in &acordes {
            for &(midi, fim, ini) in &a.notas {
                registrar(&mut tr, a.inicio, a.dur, midi, fim, ini);
            }
        }
        eventos.extend(tr.notas);
    }
    let chave = |x: f64| (x * 10000.0).round() as i64;
    let mut cortes: Vec<i64> = eventos
        .iter()
        .flat_map(|e| [chave(e.inicio), chave(e.inicio + e.dur)])
        .collect();
    cortes.sort_unstable();
    cortes.dedup();

    let mut intervalos: Vec<(i64, i64, Vec<usize>)> = vec![];
    for w in cortes.windows(2) {
        let (a, b) = (w[0], w[1]);
        let mut ativos: Vec<usize> = (0..eventos.len())
            .filter(|&i| chave(eventos[i].inicio) <= a && chave(eventos[i].inicio + eventos[i].dur) >= b)
            .collect();
        if ativos.is_empty() {
            continue;
        }
        ativos.sort_by(|&x, &y| eventos[y].midi.cmp(&eventos[x].midi).then(x.cmp(&y)));
        ativos.dedup_by_key(|i| eventos[*i].midi);
        intervalos.push((a, b, ativos));
    }

    let mut max = intervalos.iter().map(|i| i.2.len()).max().unwrap_or(0);
    let mut omitidos = 0;
    if let Some(l) = limite.filter(|&l| l > 0 && l < max) {
        omitidos = intervalos.iter().filter(|i| i.2.len() > l).count();
        max = l;
    }
    let mut saida = vec![];
    for r in 0..max {
        let mut evs: Vec<Evento> = vec![];
        let mut ultimo: Option<(usize, i64)> = None; // (nota de origem, fim)
        for (a, b, ativos) in &intervalos {
            let n = ativos.len();
            let pos = if n > max && max > 1 { (r * (n - 1) + (max - 1) / 2) / (max - 1) } else { r.min(n - 1) };
            let id = ativos[pos];
            if matches!(ultimo, Some((i, fim)) if i == id && fim == *a) {
                let e = evs.last_mut().unwrap();
                e.dur = *b as f64 / 10000.0 - e.inicio;
            } else {
                evs.push(Evento {
                    inicio: *a as f64 / 10000.0,
                    dur: (*b - *a) as f64 / 10000.0,
                    midi: eventos[id].midi,
                });
            }
            ultimo = Some((id, *b));
        }
        saida.push(evs);
    }
    (saida, omitidos)
}

/// Monta a letra a partir das sílabas, **ordenadas pelo tempo da nota** (e não pela ordem no
/// arquivo, onde as camadas de uma pauta vêm uma depois da outra). Cada estrofe (`<no>`,
/// 0 = primeira) vira uma sequência de linhas, com quebra a cada respiração. Estrofes são
/// separadas por uma linha vazia e a primeira linha de cada uma leva "N. ". Se duas camadas
/// trazem sílaba para o mesmo instante e estrofe, vale a da voz mais alta (menor número).
fn montar_letra(mut silabas: Vec<Silaba>, mut respiracoes: Vec<f64>) -> Vec<String> {
    const EPS: f64 = 1e-6;
    silabas.sort_by(|a, b| a.t.total_cmp(&b.t).then(a.voz.cmp(&b.voz)));
    respiracoes.sort_by(|a, b| a.total_cmp(b));

    struct Estrofe {
        linhas: Vec<String>,
        espaco: bool,
        quebra_vista: usize,
        ultimo_t: f64,
    }
    let mut estrofes: BTreeMap<u32, Estrofe> = BTreeMap::new();

    for sil in silabas {
        let e = estrofes.entry(sil.verso).or_insert_with(|| Estrofe {
            linhas: vec![String::new()],
            espaco: false,
            quebra_vista: 0,
            ultimo_t: f64::NEG_INFINITY,
        });
        if (sil.t - e.ultimo_t).abs() < EPS {
            continue; // outra camada com a mesma sílaba no mesmo instante
        }
        e.ultimo_t = sil.t;
        let quebras = respiracoes.iter().filter(|&&r| r <= sil.t + EPS).count();
        if quebras > e.quebra_vista {
            e.quebra_vista = quebras;
            if !e.linhas.last().is_some_and(|l| l.is_empty()) {
                e.linhas.push(String::new());
                e.espaco = false;
            }
        }
        let linha = e.linhas.last_mut().unwrap();
        if e.espaco && !linha.is_empty() {
            linha.push(' ');
        }
        linha.push_str(&sil.texto);
        e.espaco = !sil.continua;
    }

    let mut saida = vec![];
    for (verso, e) in estrofes {
        if !saida.is_empty() {
            saida.push(String::new());
        }
        for (i, l) in e.linhas.into_iter().filter(|l| !l.is_empty()).enumerate() {
            saida.push(if i == 0 { format!("{}. {l}", verso + 1) } else { l });
        }
    }
    saida
}

/// Todo o texto dentro de um elemento (inclui trechos com formatação), sem espaços repetidos.
fn texto_completo(n: Node) -> String {
    let junto: String = n.descendants().filter(|d| d.is_text()).filter_map(|d| d.text()).collect();
    junto.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Textos de moldura (`<Text>` com `<style>` igual a um dos estilos pedidos), na ordem do arquivo.
fn texto_de_estilo(doc: &Document, estilos: &[&str]) -> Vec<String> {
    let mut achados: Vec<(usize, String)> = vec![];
    for n in doc.descendants().filter(|n| n.has_tag_name("Text")) {
        let Some(estilo) = texto(n, "style") else { continue };
        let Some(pos) = estilos.iter().position(|e| *e == estilo) else { continue };
        if let Some(t) = filho(n, "text") {
            let t = texto_completo(t);
            if !t.is_empty() {
                achados.push((pos, t));
            }
        }
    }
    // Primeiro por ordem dos estilos pedidos (ex.: letrista antes de compositor), mantendo a do arquivo.
    achados.sort_by_key(|(pos, _)| *pos);
    achados.into_iter().map(|(_, t)| t).collect()
}

/// "Parte I..IV" -> vozes do coro, na ordem do hinário.
pub fn nomes_satb(h: &mut Hino) {
    for v in &mut h.vozes {
        let novo = match v.nome.as_str() {
            "Parte I" => "Soprano",
            "Parte II" => "Contralto",
            "Parte III" => "Tenor",
            "Parte IV" => "Baixo",
            _ => continue,
        };
        v.nome = novo.to_string();
    }
}

fn e_romano(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| matches!(c, 'I' | 'V' | 'X'))
}

/// "Parte I e II" -> ["Parte I", "Parte II"]: completa o prefixo quando sobra só o numeral.
fn nome_da_parte(partes: &[&str], i: usize) -> String {
    let p = partes[i].trim();
    let prefixo = partes[0].split_whitespace().next().unwrap_or("");
    if i > 0 && e_romano(p) && prefixo != p {
        format!("{prefixo} {p}")
    } else {
        p.to_string()
    }
}

fn arredondar(x: f64) -> f64 {
    (x * 10000.0).round() / 10000.0
}

pub fn converter(xml: &str, numero_hino: u32) -> Result<Hino, String> {
    let doc = Document::parse(xml).map_err(|e| format!("XML inválido: {e}"))?;
    let score = doc
        .descendants()
        .find(|n| n.has_tag_name("Score"))
        .ok_or("não parece um arquivo MuseScore (.mscx): falta <Score>")?;

    // Nome da parte de cada pauta: id da pauta -> (nome, posição na parte, total de pautas).
    let mut info: HashMap<&str, (String, usize, usize)> = HashMap::new();
    for parte in score.children().filter(|c| c.has_tag_name("Part")) {
        let nome = texto(parte, "trackName")
            .filter(|s| !s.is_empty())
            .or_else(|| filho(parte, "Instrument").and_then(|i| texto(i, "longName")))
            .unwrap_or("")
            .to_string();
        let pautas: Vec<_> = parte.children().filter(|c| c.has_tag_name("Staff")).collect();
        for (i, p) in pautas.iter().enumerate() {
            if let Some(id) = p.attribute("id") {
                info.insert(id, (nome.clone(), i + 1, pautas.len()));
            }
        }
    }

    let divisao: f64 = filho(score, "Division")
        .and_then(|d| d.text())
        .and_then(|t| t.trim().parse().ok())
        .unwrap_or(480.0);
    let mut vozes: Vec<Voz> = vec![];
    let mut avisos: Vec<String> = vec![];
    let mut letra: Vec<String> = vec![];
    let mut andamento = None;

    let pautas = score
        .children()
        .filter(|c| c.has_tag_name("Staff") && c.children().any(|m| m.has_tag_name("Measure")));
    for pauta in pautas {
        let id = pauta.attribute("id").unwrap_or("?");
        let (nome_parte, pos_pauta, total) = info.get(id).cloned().unwrap_or((String::new(), 1, 1));
        let (mut sig_n, mut sig_d) = (4.0f64, 4.0f64);
        let mut inicio_compasso = 0.0;
        let mut da_pauta: BTreeMap<usize, Vec<Acorde>> = BTreeMap::new();
        let mut silabas: Vec<Silaba> = vec![];
        let mut respiracoes: Vec<f64> = vec![];

        for compasso in pauta.children().filter(|c| c.has_tag_name("Measure")) {
            if let Some(ts) = compasso.descendants().find(|n| n.has_tag_name("TimeSig")) {
                if let (Some(n), Some(d)) = (numero::<f64>(ts, "sigN"), numero::<f64>(ts, "sigD")) {
                    (sig_n, sig_d) = (n, d);
                }
            }
            let comp = compasso
                .attribute("len")
                .and_then(fracao)
                .unwrap_or(sig_n / sig_d * 4.0);

            // MuseScore 2: as vozes ficam soltas no compasso (<tick>/<track>) e <voice>
            // traz só as demais. MuseScore 3: todas as vozes ficam em <voice>.
            let solta = compasso
                .children()
                .any(|c| matches!(c.tag_name().name(), "Chord" | "Rest" | "Tuplet"));
            let mut fontes: Vec<(usize, bool, Node)> = vec![];
            if solta {
                fontes.push((0, true, compasso));
            }
            let desloc = usize::from(solta);
            for (k, v) in compasso.children().filter(|c| c.has_tag_name("voice")).enumerate() {
                fontes.push((k + desloc, false, v));
            }

            for (voz, plano, no) in fontes {
                let mut est = Estado {
                    andamento,
                    tuplos: vec![],
                    compasso: comp,
                    plano,
                    voz_base: voz,
                    divisao,
                    saida: &mut da_pauta,
                    silabas: &mut silabas,
                    respiracoes: &mut respiracoes,
                };
                let mut t = inicio_compasso;
                percorrer(no, &mut t, &mut est)?;
                andamento = est.andamento;
            }
            inicio_compasso += comp;
        }

        if letra.is_empty() && !silabas.is_empty() {
            letra = montar_letra(silabas, respiracoes);
        }
        let base = if nome_parte.is_empty() { format!("Voz {id}") } else { nome_parte.clone() };
        let sufixo = if total > 1 { format!(" (pauta {pos_pauta})") } else { String::new() };
        let partes: Vec<&str> = base.split(" e ").collect();
        let limite = (partes.len() > 1).then_some(partes.len());
        let (linhas, omitidos) = dividir_em_vozes(da_pauta.into_values().collect(), limite);
        if omitidos > 0 {
            avisos.push(format!(
                "{base}{sufixo}: {omitidos} trecho(s) com mais notas simultâneas que vozes; notas do meio omitidas"
            ));
        }
        let max = linhas.len();
        for (r, notas) in linhas.into_iter().enumerate() {
            let nome = if max == 1 {
                format!("{base}{sufixo}")
            } else if partes.len() == max {
                format!("{}{sufixo}", nome_da_parte(&partes, r))
            } else {
                format!("{base}{sufixo} ({})", r + 1)
            };
            vozes.push(Voz { nome, notas });
        }
    }

    if doc.descendants().any(|n| {
        matches!(n.tag_name().name(), "startRepeat" | "endRepeat" | "Jump" | "Volta")
    }) {
        avisos.push("há repetições/saltos: não foram expandidos (a partitura é lida uma vez, em ordem)".to_string());
    }

    if vozes.is_empty() {
        return Err("nenhuma nota encontrada".into());
    }

    // Título: texto de moldura com estilo "Title"; senão o metadado workTitle; senão "Hino N".
    let titulo = texto_de_estilo(&doc, &["Title"])
        .into_iter()
        .next()
        .or_else(|| {
            doc.descendants()
                .find(|n| n.has_tag_name("metaTag") && n.attribute("name") == Some("workTitle"))
                .map(texto_completo)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| format!("Hino {numero_hino}"));

    // Autoria: textos de moldura com estilo "Lyricist" e "Composer", sem repetir e na ordem do arquivo.
    let mut nomes: Vec<String> = vec![];
    for n in texto_de_estilo(&doc, &["Lyricist", "Composer"]) {
        if !nomes.contains(&n) {
            nomes.push(n);
        }
    }
    let autoria = (!nomes.is_empty()).then(|| nomes.join(" · "));

    Ok(Hino { numero: numero_hino, titulo, autoria, andamento, vozes, letra, avisos })
}

pub fn para_json(h: &Hino) -> Value {
    let mut m = Map::new();
    m.insert("numero".into(), json!(h.numero));
    m.insert("titulo".into(), json!(h.titulo));
    if let Some(a) = &h.autoria {
        m.insert("autoria".into(), json!(a));
    }
    if let Some(a) = h.andamento {
        m.insert("andamento".into(), json!(a));
    }
    let vozes: Vec<Value> = h
        .vozes
        .iter()
        .map(|v| {
            let notas: Vec<Value> = v
                .notas
                .iter()
                .map(|n| json!([arredondar(n.inicio), arredondar(n.dur), n.midi]))
                .collect();
            json!({ "nome": v.nome, "notas": notas })
        })
        .collect();
    if !h.letra.is_empty() {
        m.insert("letra".into(), json!(h.letra));
    }
    m.insert("vozes".into(), Value::Array(vozes));
    Value::Object(m)
}

/// Cabeçalho do hinário; `idioma` (ex.: "pt-BR") só entra se for informado.
fn cabecalho(id: &str, nome: &str, idioma: Option<&str>) -> Value {
    let mut m = Map::new();
    m.insert("id".into(), json!(id));
    m.insert("nome".into(), json!(nome));
    if let Some(i) = idioma.filter(|i| !i.trim().is_empty()) {
        m.insert("idioma".into(), json!(i.trim()));
    }
    Value::Object(m)
}

const AJUDA: &str = "Uso: mscx2json [--nomes-originais] [--idioma pt-BR] --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json\n\
--idioma declara o idioma do conteúdo (título e letra) no hinário gerado.\n\
--nomes-originais mantém \"Parte I..IV\" em vez de Soprano/Contralto/Tenor/Baixo.\n\
Os arquivos devem se chamar hino-<número>.mscx; os demais são ignorados com um aviso.";

fn numero_do_arquivo(p: &Path) -> Option<u32> {
    p.file_stem()?.to_str()?.strip_prefix("hino-")?.parse().ok()
}

fn executar(args: Vec<String>) -> Result<(), String> {
    let (mut id, mut nome, mut entradas) = (None, None, vec![]);
    let mut renomear = true;
    let mut idioma: Option<String> = None;
    let mut it = args.into_iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--id" => id = it.next(),
            "--nome" => nome = it.next(),
            "--nomes-originais" => renomear = false,
            "--idioma" => idioma = it.next(),
            "-h" | "--ajuda" => {
                println!("{AJUDA}");
                return Ok(());
            }
            _ => entradas.push(PathBuf::from(a)),
        }
    }
    let (id, nome) = (id.ok_or(AJUDA)?, nome.ok_or(AJUDA)?);

    let mut arquivos = vec![];
    for e in entradas {
        if e.is_dir() {
            let mut dentro: Vec<_> = std::fs::read_dir(&e)
                .map_err(|x| format!("{}: {x}", e.display()))?
                .filter_map(|x| x.ok().map(|x| x.path()))
                .filter(|p| p.extension().is_some_and(|x| x == "mscx"))
                .collect();
            dentro.sort();
            arquivos.extend(dentro);
        } else {
            arquivos.push(e);
        }
    }
    if arquivos.is_empty() {
        return Err(AJUDA.into());
    }

    let mut hinos: Vec<Hino> = vec![];
    for arq in arquivos {
        let Some(n) = numero_do_arquivo(&arq) else {
            eprintln!("aviso: {} ignorado (nome fora do padrão hino-<número>.mscx)", arq.display());
            continue;
        };
        let xml = std::fs::read_to_string(&arq).map_err(|e| format!("{}: {e}", arq.display()))?;
        let mut h = converter(&xml, n).map_err(|e| format!("{}: {e}", arq.display()))?;
        if renomear {
            nomes_satb(&mut h);
        }
        for a in &h.avisos {
            eprintln!("aviso: {}: {a}", arq.display());
        }
        hinos.push(h);
    }
    hinos.sort_by_key(|h| h.numero);
    if let Some(p) = hinos.windows(2).find(|p| p[0].numero == p[1].numero) {
        return Err(format!("número de hino repetido: {}", p[0].numero));
    }

    let saida = json!({
        "versao": 1,
        "hinario": cabecalho(&id, &nome, idioma.as_deref()),
        "hinos": hinos.iter().map(para_json).collect::<Vec<_>>(),
    });
    println!("{}", serde_json::to_string(&saida).map_err(|e| e.to_string())?);
    Ok(())
}

fn main() {
    if let Err(e) = executar(std::env::args().skip(1).collect()) {
        eprintln!("erro: {e}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn parte(id: u32, nome: &str) -> String {
        format!(r#"<Part><Staff id="{id}"/><trackName>{nome}</trackName></Part>"#)
    }
    fn doc(partes: &str, pautas: &str) -> String {
        format!(
            r#"<?xml version="1.0"?><museScore version="3.02"><Score><Division>480</Division>
            <metaTag name="workTitle">Título fictício</metaTag>{partes}{pautas}</Score></museScore>"#
        )
    }
    fn acorde(tipo: &str, pitch: u8) -> String {
        format!("<Chord><durationType>{tipo}</durationType><Note><pitch>{pitch}</pitch></Note></Chord>")
    }
    fn pauta(id: u32, compassos: &str) -> String {
        format!(r#"<Staff id="{id}">{compassos}</Staff>"#)
    }
    fn compasso(corpo: &str) -> String {
        format!("<Measure><voice>{corpo}</voice></Measure>")
    }
    const C44: &str = "<TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>";

    fn notas(h: &Hino, voz: usize) -> Vec<(f64, f64, u8)> {
        h.vozes[voz].notas.iter().map(|n| (n.inicio, n.dur, n.midi)).collect()
    }

    #[test]
    fn notas_simples_titulo_e_andamento() {
        let corpo = format!(
            "{C44}<Tempo><tempo>1.5</tempo></Tempo>{}{}{}{}",
            acorde("quarter", 72), acorde("quarter", 74), acorde("quarter", 76), acorde("quarter", 77)
        );
        let h = converter(&doc(&parte(1, "Soprano"), &pauta(1, &compasso(&corpo))), 7).unwrap();
        assert_eq!((h.numero, h.titulo.as_str(), h.andamento), (7, "Título fictício", Some(90)));
        assert_eq!(h.vozes[0].nome, "Soprano");
        assert_eq!(notas(&h, 0), vec![(0.0, 1.0, 72), (1.0, 1.0, 74), (2.0, 1.0, 76), (3.0, 1.0, 77)]);
    }

    #[test]
    fn pontuada_pausa_e_segundo_compasso() {
        let c1 = format!(
            "{C44}<Chord><durationType>quarter</durationType><dots>1</dots><Note><pitch>60</pitch></Note></Chord>{}<Rest><durationType>half</durationType></Rest>",
            acorde("eighth", 62)
        );
        let c2 = acorde("whole", 64);
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))), 1).unwrap();
        assert_eq!(notas(&h, 0), vec![(0.0, 1.5, 60), (1.5, 0.5, 62), (4.0, 4.0, 64)]);
    }

    #[test]
    fn pausa_de_compasso_inteiro_usa_o_tamanho_do_compasso() {
        let c1 = format!("{C44}<Rest><durationType>measure</durationType><duration>4/4</duration></Rest>");
        let c2 = acorde("quarter", 60);
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))), 1).unwrap();
        assert_eq!(notas(&h, 0), vec![(4.0, 1.0, 60)]);
    }

    #[test]
    fn anacruse_com_len() {
        let c1 = format!(r#"<Measure len="1/4"><voice>{C44}{}</voice></Measure>"#, acorde("quarter", 60));
        let c2 = compasso(&acorde("whole", 62));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &(c1 + &c2))), 1).unwrap();
        assert_eq!(notas(&h, 0), vec![(0.0, 1.0, 60), (1.0, 4.0, 62)]);
    }

    #[test]
    fn tercina_estilo_marcador_e_aninhado() {
        let tupla = "<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes></Tuplet>";
        let tres = format!("{}{}{}", acorde("eighth", 60), acorde("eighth", 62), acorde("eighth", 64));
        let plano = format!("{C44}{tupla}{tres}<endTuplet/>{}", acorde("quarter", 65));
        let aninhado = format!(
            "{C44}<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes>{tres}</Tuplet>{}",
            acorde("quarter", 65)
        );
        for corpo in [plano, aninhado] {
            let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&corpo))), 1).unwrap();
            let n = notas(&h, 0);
            assert!((n[1].0 - 1.0 / 3.0).abs() < 1e-3 && (n[1].1 - 1.0 / 3.0).abs() < 1e-3);
            assert!((n[3].0 - 1.0).abs() < 1e-3, "a nota depois da tercina começa em 1: {n:?}");
        }
    }

    #[test]
    fn ligadura_une_as_notas() {
        let inicio = r#"<Chord><durationType>half</durationType><Note><Spanner type="Tie"><Tie/><next><location><fractions>1/2</fractions></location></next></Spanner><pitch>60</pitch></Note></Chord>"#;
        let fim = r#"<Chord><durationType>quarter</durationType><Note><Spanner type="Tie"><prev><location><fractions>-1/2</fractions></location></prev></Spanner><pitch>60</pitch></Note></Chord>"#;
        let c = format!("{C44}{inicio}{fim}{}", acorde("quarter", 62));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        assert_eq!(notas(&h, 0), vec![(0.0, 3.0, 60), (3.0, 1.0, 62)]);
    }

    #[test]
    fn acorde_com_duas_notas_e_apojatura_ignorada() {
        let ac = "<Chord><durationType>half</durationType><Note><pitch>64</pitch></Note><Note><pitch>60</pitch></Note></Chord>";
        let graca = "<Chord><acciaccatura/><durationType>eighth</durationType><Note><pitch>70</pitch></Note></Chord>";
        let c = format!("{C44}{graca}{ac}");
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        // A nota mais aguda vira a primeira voz, a mais grave a segunda.
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["S (1)", "S (2)"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 64)]);
        assert_eq!(notas(&h, 1), vec![(0.0, 2.0, 60)]);
    }

    fn compasso_ms2(corpo: &str, extra_voz: &str) -> String {
        format!("<Measure>{corpo}{extra_voz}</Measure>")
    }

    #[test]
    fn musescore_2_voz_solta_no_compasso() {
        let corpo = format!("{C44}<Tempo><tempo>1</tempo></Tempo>{}{}", acorde("half", 60), acorde("half", 62));
        let extra = format!("<voice>{}</voice>", acorde("whole", 55));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, &extra))), 1).unwrap();
        assert_eq!(h.andamento, Some(60));
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["S (1)", "S (2)"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 60), (2.0, 2.0, 62)]);
        assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 55)]); // nota longa continua uma só
    }

    #[test]
    fn musescore_2_vozes_soltas_com_tick_e_track() {
        // Voz 1: duas mínimas. Depois <tick>0 e a voz 2 (track 1): semibreve.
        // Em seguida <tick>960 (batida 2) e a voz 3 (track 2): mínima.
        let corpo = format!(
            "{C44}{}{}<tick>0</tick><Chord><track>1</track><durationType>whole</durationType><Note><pitch>55</pitch></Note></Chord>\
             <tick>960</tick><Chord><track>2</track><durationType>half</durationType><Note><pitch>48</pitch></Note></Chord>",
            acorde("half", 60), acorde("half", 62)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, ""))), 1).unwrap();
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["S (1)", "S (2)", "S (3)"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 60), (2.0, 2.0, 62)]);
        assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 55)]);
        // Entre 0 e 2 só soam duas notas: a 3ª voz repete a última (uníssono).
        assert_eq!(notas(&h, 2), vec![(0.0, 2.0, 55), (2.0, 2.0, 48)]);
    }

    #[test]
    fn limita_vozes_ao_nome_da_pauta_e_avisa() {
        let tres = "<Chord><durationType>whole</durationType><Note><pitch>60</pitch></Note><Note><pitch>64</pitch></Note><Note><pitch>67</pitch></Note></Chord>";
        let c = format!("{C44}{tres}");
        let h = converter(&doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["Parte I", "Parte II"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 67)]); // mais aguda
        assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 60)]); // mais grave
        assert!(h.avisos.iter().any(|a| a.contains("notas do meio omitidas")), "{:?}", h.avisos);
    }

    #[test]
    fn letra_por_estrofe_com_silabas_e_quebra_na_respiracao() {
        let ac = |sil: &[(&str, Option<u32>, &str)], pitch: u8| {
            let ls: String = sil
                .iter()
                .map(|(sy, no, t)| {
                    let no = no.map(|n| format!("<no>{n}</no>")).unwrap_or_default();
                    let sy = if sy.is_empty() { String::new() } else { format!("<syllabic>{sy}</syllabic>") };
                    format!("<Lyrics>{no}{sy}<text>{t}</text></Lyrics>")
                })
                .collect();
            format!("<Chord><durationType>quarter</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord>")
        };
        let c = format!(
            "{C44}{}{}<Breath/>{}",
            ac(&[("begin", None, "ba"), ("", Some(1), "la")], 60),
            ac(&[("end", None, "la"), ("", Some(1), "lá")], 62),
            ac(&[("", None, "um"), ("", Some(1), "dois")], 64),
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. bala", "um", "", "2. la lá", "dois"]);
        assert!(para_json(&h)["letra"].is_array());
    }

    #[test]
    fn letra_segue_o_tempo_e_nao_a_ordem_no_arquivo() {
        // Voz 1: pausa de mínima e, na batida 2, "c". Depois <tick>0 e a camada 2 traz "a" (t=0)
        // e "b" (t=1): no arquivo vêm DEPOIS de "c", mas no tempo vêm antes.
        let l = |t: &str| format!("<Lyrics><text>{t}</text></Lyrics>");
        let ch = |t: &str, p: u8, extra: &str| {
            format!("<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>", l(t))
        };
        let c = format!(
            "{C44}<Rest><durationType>half</durationType></Rest>{}<tick>0</tick>{}{}",
            ch("c", 60, ""),
            ch("a", 62, "<track>1</track>"),
            ch("b", 64, "<track>1</track>"),
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. a b c"]);
    }

    #[test]
    fn letra_duplicada_em_duas_camadas_vale_uma_vez() {
        let l = |t: &str| format!("<Lyrics><text>{t}</text></Lyrics>");
        let ch = |t: &str, p: u8, extra: &str| {
            format!("<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>", l(t))
        };
        let c = format!("{C44}{}<tick>0</tick>{}", ch("la", 60, ""), ch("la", 55, "<track>1</track>"));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. la"]);
    }

    #[test]
    fn sem_letra_nao_gera_campo() {
        let c = format!("{C44}{}", acorde("whole", 60));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        assert!(h.letra.is_empty() && para_json(&h).get("letra").is_none());
    }

    #[test]
    fn renomeia_partes_para_vozes_do_coro() {
        let mut h = Hino {
            numero: 1,
            titulo: "T".into(),
            autoria: None,
            andamento: None,
            vozes: ["Parte I", "Parte II", "Parte III", "Parte IV", "Outra"]
                .iter()
                .map(|n| Voz { nome: n.to_string(), notas: vec![] })
                .collect(),
            letra: vec![],
            avisos: vec![],
        };
        nomes_satb(&mut h);
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["Soprano", "Contralto", "Tenor", "Baixo", "Outra"]);
    }

    fn texto_moldura(estilo: &str, t: &str) -> String {
        format!("<Text><style>{estilo}</style><text>{t}</text></Text>")
    }
    /// Documento sem metaTag, só com a moldura informada e uma nota (para testar título e autoria).
    fn doc_com_moldura(moldura: &str) -> String {
        let nota = format!("{C44}{}", acorde("whole", 60));
        format!(
            r#"<?xml version="1.0"?><museScore version="2.06"><Score><Division>480</Division>{moldura}{}{}</Score></museScore>"#,
            parte(1, "S"),
            pauta(1, &compasso(&nota))
        )
    }

    #[test]
    fn titulo_e_autoria_vem_dos_textos_de_moldura() {
        let moldura = format!(
            "<VBox>{}{}{}</VBox>",
            texto_moldura("Title", "Título real"),
            texto_moldura("Composer", "Fulana de Tal"),
            texto_moldura("Instrument Name (Part)", "7"),
        );
        let h = converter(&doc_com_moldura(&moldura), 7).unwrap();
        assert_eq!(h.titulo, "Título real");
        assert_eq!(h.autoria.as_deref(), Some("Fulana de Tal"));
        assert_eq!(para_json(&h)["autoria"], "Fulana de Tal");
    }

    #[test]
    fn sem_moldura_o_titulo_cai_no_metadado_e_depois_em_hino_n() {
        // doc() traz <metaTag name="workTitle">Título fictício</metaTag>
        let c = format!("{C44}{}", acorde("whole", 60));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        assert_eq!(h.titulo, "Título fictício");
        assert_eq!(h.autoria, None);
        assert!(para_json(&h).get("autoria").is_none());

        let h = converter(&doc_com_moldura(""), 5).unwrap();
        assert_eq!(h.titulo, "Hino 5");
    }

    #[test]
    fn autoria_junta_letrista_e_compositor_sem_repetir() {
        let m = format!(
            "<VBox>{}{}{}</VBox>",
            texto_moldura("Composer", "B"),
            texto_moldura("Lyricist", "A"),
            texto_moldura("Composer", "B"),
        );
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.autoria.as_deref(), Some("A · B")); // letrista primeiro, sem repetir

        let m = format!("<VBox>{}{}</VBox>", texto_moldura("Lyricist", "A"), texto_moldura("Composer", "A"));
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.autoria.as_deref(), Some("A")); // mesma pessoa nos dois papéis
    }

    #[test]
    fn titulo_com_formatacao_e_espacos_repetidos_sai_limpo() {
        let m = format!("<VBox>{}</VBox>", texto_moldura("Title", "Canta, <i>ó</i>   Mundo\n  Hoje"));
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.titulo, "Canta, ó Mundo Hoje");
    }

    #[test]
    fn cabecalho_so_leva_idioma_quando_informado() {
        assert_eq!(cabecalho("a", "A", Some("pt-BR")), json!({"id":"a","nome":"A","idioma":"pt-BR"}));
        assert_eq!(cabecalho("a", "A", None), json!({"id":"a","nome":"A"}));
        assert_eq!(cabecalho("a", "A", Some("  ")), json!({"id":"a","nome":"A"}));
    }

    #[test]
    fn nomes_de_partes() {
        assert_eq!(nome_da_parte(&["Parte I", "II"], 1), "Parte II");
        assert_eq!(nome_da_parte(&["Parte III", "IV"], 1), "Parte IV");
        assert_eq!(nome_da_parte(&["Soprano", "Contralto"], 1), "Contralto");
    }

    #[test]
    fn parte_i_e_ii_vira_duas_vozes_com_unissono() {
        let duas = |a: u8, b: u8| {
            format!("<Chord><durationType>half</durationType><Note><pitch>{b}</pitch></Note><Note><pitch>{a}</pitch></Note></Chord>")
        };
        let c = format!("{C44}{}{}", duas(60, 67), acorde("half", 65)); // 2º acorde: uníssono
        let h = converter(&doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["Parte I", "Parte II"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 67), (2.0, 2.0, 65)]);
        assert_eq!(notas(&h, 1), vec![(0.0, 2.0, 60), (2.0, 2.0, 65)]);
    }

    #[test]
    fn duas_pautas_e_duas_vozes_viram_vozes_separadas() {
        let partes = parte(1, "Soprano") + &parte(2, "Baixo");
        let v1 = acorde("whole", 72);
        let v2 = acorde("whole", 60);
        let s1 = pauta(1, &format!("<Measure><voice>{C44}{v1}</voice><voice>{v2}</voice></Measure>"));
        let s2 = pauta(2, &compasso(&format!("{C44}{}", acorde("whole", 48))));
        let h = converter(&doc(&partes, &(s1 + &s2)), 1).unwrap();
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["Soprano (1)", "Soprano (2)", "Baixo"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 72)]);
        assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 60)]);
        assert_eq!(notas(&h, 2), vec![(0.0, 4.0, 48)]);
    }

    #[test]
    fn avisa_sobre_repeticoes_e_rejeita_arquivo_errado() {
        let c = format!("<Measure><startRepeat/><voice>{C44}{}</voice></Measure>", acorde("whole", 60));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &c)), 1).unwrap();
        assert!(h.avisos[0].contains("repetições"));
        assert!(converter("<x/>", 1).unwrap_err().contains("falta <Score>"));
        assert!(converter("{ não é xml", 1).unwrap_err().contains("XML inválido"));
        assert!(converter(&doc("", &pauta(1, &compasso(C44))), 1).unwrap_err().contains("nenhuma nota"));
    }

    #[test]
    fn json_no_formato_do_app() {
        let c = format!("{C44}{}", acorde("whole", 60));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 3).unwrap();
        let j = para_json(&h);
        assert_eq!(j["numero"], 3);
        assert_eq!(j["vozes"][0]["notas"][0], json!([0.0, 4.0, 60]));
        assert!(j.get("andamento").is_none());
    }

    #[test]
    fn numero_vem_do_nome_do_arquivo() {
        assert_eq!(numero_do_arquivo(Path::new("x/hino-42.mscx")), Some(42));
        assert_eq!(numero_do_arquivo(Path::new("coro-1.mscx")), None);
    }
}
