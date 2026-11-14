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
    pub andamento: Option<u32>,
    pub vozes: Vec<Voz>,
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

#[derive(Default)]
struct Trilha {
    notas: Vec<Evento>,
    /// Notas ligadas esperando continuação: (midi, índice em `notas`).
    pendentes: Vec<(u8, usize)>,
}

struct Estado<'a> {
    andamento: Option<u32>,
    tuplos: Vec<f64>,
    compasso: f64,
    trilha: &'a mut Trilha,
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
            "endTuplet" => {
                est.tuplos.pop();
            }
            "Rest" => *t += duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>(),
            "Chord" => {
                if e_apojatura(c) {
                    continue;
                }
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                for nota in c.children().filter(|n| n.has_tag_name("Note")) {
                    if texto(nota, "play") == Some("0") {
                        continue;
                    }
                    let midi: u8 = numero(nota, "pitch").ok_or("nota sem <pitch> válido")?;
                    registrar(est.trilha, *t, dur, midi, liga_fim(nota), liga_inicio(nota));
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

    let mut trilhas: BTreeMap<(usize, usize), (String, Trilha)> = BTreeMap::new();
    let mut andamento = None;

    let pautas = score
        .children()
        .filter(|c| c.has_tag_name("Staff") && c.children().any(|m| m.has_tag_name("Measure")));
    for (ordem, pauta) in pautas.enumerate() {
        let id = pauta.attribute("id").unwrap_or("?");
        let (nome_parte, pos_pauta, total) = info.get(id).cloned().unwrap_or((String::new(), 1, 1));
        let (mut sig_n, mut sig_d) = (4.0f64, 4.0f64);
        let mut inicio_compasso = 0.0;

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

            for (v, voz) in compasso.children().filter(|c| c.has_tag_name("voice")).enumerate() {
                let nome = {
                    let base = if nome_parte.is_empty() { format!("Voz {id}") } else { nome_parte.clone() };
                    let mut n = base;
                    if total > 1 {
                        n += &format!(" (pauta {pos_pauta})");
                    }
                    if v > 0 {
                        n += &format!(" - voz {}", v + 1);
                    }
                    n
                };
                let entrada = trilhas.entry((ordem, v)).or_insert_with(|| (nome, Trilha::default()));
                let mut est = Estado {
                    andamento,
                    tuplos: vec![],
                    compasso: comp,
                    trilha: &mut entrada.1,
                };
                let mut t = inicio_compasso;
                percorrer(voz, &mut t, &mut est)?;
                andamento = est.andamento;
            }
            inicio_compasso += comp;
        }
    }

    let mut avisos = vec![];
    if doc.descendants().any(|n| {
        matches!(n.tag_name().name(), "startRepeat" | "endRepeat" | "Jump" | "Volta")
    }) {
        avisos.push("há repetições/saltos: não foram expandidos (a partitura é lida uma vez, em ordem)".to_string());
    }

    let vozes: Vec<Voz> = trilhas
        .into_values()
        .filter(|(_, t)| !t.notas.is_empty())
        .map(|(nome, mut t)| {
            t.notas.sort_by(|a, b| a.inicio.total_cmp(&b.inicio).then(a.midi.cmp(&b.midi)));
            Voz { nome, notas: t.notas }
        })
        .collect();
    if vozes.is_empty() {
        return Err("nenhuma nota encontrada".into());
    }

    let titulo = doc
        .descendants()
        .find(|n| n.has_tag_name("metaTag") && n.attribute("name") == Some("workTitle"))
        .and_then(|n| n.text())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| format!("Hino {numero_hino}"));

    Ok(Hino { numero: numero_hino, titulo, andamento, vozes, avisos })
}

pub fn para_json(h: &Hino) -> Value {
    let mut m = Map::new();
    m.insert("numero".into(), json!(h.numero));
    m.insert("titulo".into(), json!(h.titulo));
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
    m.insert("vozes".into(), Value::Array(vozes));
    Value::Object(m)
}

const AJUDA: &str = "Uso: mscx2json --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json\n\
Os arquivos devem se chamar hino-<número>.mscx; os demais são ignorados com um aviso.";

fn numero_do_arquivo(p: &Path) -> Option<u32> {
    p.file_stem()?.to_str()?.strip_prefix("hino-")?.parse().ok()
}

fn executar(args: Vec<String>) -> Result<(), String> {
    let (mut id, mut nome, mut entradas) = (None, None, vec![]);
    let mut it = args.into_iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--id" => id = it.next(),
            "--nome" => nome = it.next(),
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
        let h = converter(&xml, n).map_err(|e| format!("{}: {e}", arq.display()))?;
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
        "hinario": { "id": id, "nome": nome },
        "hinos": hinos.iter().map(para_json).collect::<Vec<_>>(),
    });
    println!("{}", serde_json::to_string_pretty(&saida).map_err(|e| e.to_string())?);
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
        assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 60), (0.0, 2.0, 64)]);
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
        assert_eq!(nomes, vec!["Soprano", "Soprano - voz 2", "Baixo"]);
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
