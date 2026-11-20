//! Converte partituras MuseScore em XML (.mscx) para o `hinario.json` do app.
//! Uso: mscx2json --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json
//!
//! Cada arquivo deve se chamar `hino-<número>.mscx`. O tempo sai em batidas
//! (semínima = 1) e as notas em MIDI, como descrito em docs/FORMATO.md.

use roxmltree::{Document, Node};
use serde_json::{Map, Value, json};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};

mod correcoes;
use correcoes::Correcoes;

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
    /// Armadura de clave do primeiro `KeySig` (−7 a −1 bemóis, 0, +1 a +7 sustenidos); 0 quando a partitura não tem o elemento.
    pub armadura: i8,
    /// `"maior"` ou `"menor"` (do arquivo, quando ele traz o modo; senão deduzido da nota final do baixo).
    pub modo: &'static str,
    /// Passada normal (uma volta do hino).
    pub vozes: Vec<Voz>,
    /// Última passada, quando o hino tem final: as mesmas vozes, na mesma ordem.
    pub passada_final: Option<Vec<Voz>>,
    /// Introdução: do começo da partitura até o marcador `*`, nas mesmas vozes, na mesma ordem.
    pub introducao: Option<Vec<Voz>>,
    pub letra: Vec<String>,
    /// Tempo de cada sílaba da letra, para o karaokê (opcional: só quando a partitura tem letra).
    pub sincronia: Option<Sincronia>,
    /// Em que instante cada compasso começa, em cada fluxo de notas, para destacar o compasso na partitura (I-12, fase B).
    pub compassos: Option<Compassos>,
    pub avisos: Vec<String>,
}

/// Uma sílaba dentro do texto da letra, com o instante em que é cantada.
/// `(inicio_em_batidas, de, ate)`: `de..ate` são posições (em unidades UTF-16, como as do JavaScript) dentro da linha
/// da letra, sem o "N. " do começo da estrofe.
pub type Trecho = (f64, usize, usize);

/// Linhas de uma estrofe: cada linha é a lista dos trechos cantados nela, na ordem do tempo. Uma linha sem nenhum
/// trecho tocado naquela passada fica como lista vazia, para o índice continuar igual ao da linha da letra.
#[derive(Debug, Clone, PartialEq)]
pub struct EstrofeSinc {
    /// Número da estrofe como aparece na letra ("1." é 1).
    pub estrofe: u32,
    pub linhas: Vec<Vec<Trecho>>,
}

/// Sincronia da letra em cada passada: o tempo de cada trecho já está na régua daquela passada (a normal ou a do
/// final), a mesma das notas das vozes.
#[derive(Debug, Clone, PartialEq)]
pub struct Sincronia {
    pub normal: Vec<EstrofeSinc>,
    pub passada_final: Option<Vec<EstrofeSinc>>,
}

/// Em que instante (em batidas, na régua de cada passada: a mesma das notas) um compasso ESCRITO começa a tocar.
/// `(inicio_em_batidas, indice_do_compasso)`: o índice conta os compassos da partitura em ordem, a partir de 0, que é também a ordem
/// dos `g.measure` do SVG da partitura. É o que o app usa para destacar o compasso que toca (I-12, fase B). O `timemap` do Verovio não
/// serve para isso: ele EXPANDE as repetições com ids de compasso que não existem no SVG (no hino 457, 56 compassos únicos contra 38
/// desenhados).
pub type InicioDeCompasso = (f64, usize);

/// Os compassos de cada fluxo de notas do hino (a passada normal, a do final e a introdução), na régua do próprio fluxo.
#[derive(Debug, Clone, PartialEq)]
pub struct Compassos {
    pub normal: Vec<InicioDeCompasso>,
    pub passada_final: Option<Vec<InicioDeCompasso>>,
    pub introducao: Option<Vec<InicioDeCompasso>>,
}

/// Posição de uma sílaba na letra montada, com o instante dela na partitura (antes de escolher a passada).
#[derive(Debug, Clone, PartialEq)]
struct Marca {
    verso: u32,
    linha: usize,
    de: usize,
    ate: usize,
    t: f64,
}

fn filho<'a, 'i>(n: Node<'a, 'i>, nome: &str) -> Option<Node<'a, 'i>> {
    n.children()
        .find(|c| c.is_element() && c.tag_name().name() == nome)
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
        c.is_element()
            && (nome.starts_with("grace") || nome == "acciaccatura" || nome == "appoggiatura")
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
#[derive(Clone)]
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
    continua: bool,     // "begin"/"middle": a palavra segue na próxima sílaba
    quebra_antes: bool, // pedido no arquivo de correções: começa uma linha nova aqui (dois versos colados)
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
    /// Instantes (em batidas) em que a introdução termina: o fim do acorde (ou da pausa) que leva o texto de pauta "*". O "*" é escrito sobre a
    /// ÚLTIMA nota da introdução, que o autor fecha com a respiração (em 413 dos 480 hinos do Dó vem "*", acorde, respiração): a introdução vai até o
    /// fim dessa nota, e não até o começo dela.
    asteriscos: &'a mut Vec<f64>,
    /// Posições, em `asteriscos`, dos "*" que ainda esperam o acorde ou a pausa que marcam. É uma lista (pode haver mais de um "*" antes da mesma nota,
    /// por exemplo um texto de pauta e uma cifra). Vale só dentro do compasso e da voz: um "*" que fica sem nota depois dele (no fim do compasso) marca o fim
    /// da nota anterior, que é o instante em que foi lido.
    asteriscos_pendentes: &'a mut Vec<usize>,
}

fn voz_do(c: Node, est: &Estado) -> usize {
    if est.plano {
        numero::<usize>(c, "track").map_or(0, |t| t % 4)
    } else {
        est.voz_base
    }
}

/// Uma respiração em `t` fecha os "*" que esperavam uma nota e não tiveram nenhuma antes dela: a introdução termina onde a respiração está.
fn fecha_asteriscos_na_respiracao(asteriscos: &mut [f64], pendentes: &mut Vec<usize>, t: f64) {
    pendentes.retain(|&i| {
        if asteriscos[i] <= t + 1e-6 {
            asteriscos[i] = t;
            false
        } else {
            true
        }
    });
}

/// O "*" marca a nota que o segue: a introdução termina no fim dela. `inicio` e `fim` são os da nota que acabou de ser lida, em batidas. Fecha TODOS os "*"
/// pendentes que estão no começo dessa nota ou antes dele; um "*" depois do começo da nota (a nota é de outra voz, que começa antes) continua esperando.
fn fecha_asterisco(est: &mut Estado, inicio: f64, fim: f64) {
    let asteriscos = &mut *est.asteriscos;
    est.asteriscos_pendentes.retain(|&i| {
        if inicio >= asteriscos[i] - 1e-6 {
            asteriscos[i] = fim;
            false
        } else {
            true
        }
    });
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
                if c.children()
                    .any(|x| x.has_tag_name("Chord") || x.has_tag_name("Rest"))
                {
                    percorrer(c, t, est)?;
                    est.tuplos.pop();
                }
            }
            "tick" if est.plano => {
                if let Some(v) = c.text().and_then(|x| x.trim().parse::<f64>().ok()) {
                    *t = v / est.divisao;
                }
            }
            "Breath" => {
                est.respiracoes.push(*t);
                // "*" logo antes da respiração, sem nota no meio: a introdução termina onde a respiração está (no 250, o "*" fica em 11 e a respiração em 12,
                // depois de um `tick`; parar no "*" deixava uma batida de fora).
                fecha_asteriscos_na_respiracao(est.asteriscos, est.asteriscos_pendentes, *t);
            }
            // O "*" aparece como texto de pauta (<StaffText><text>) ou como cifra (<Harmony><name>), conforme a partitura.
            "StaffText" | "Harmony" => {
                let rotulo = if c.has_tag_name("Harmony") {
                    "name"
                } else {
                    "text"
                };
                if filho(c, rotulo)
                    .map(texto_completo)
                    .as_deref()
                    .map(str::trim)
                    == Some("*")
                {
                    est.asteriscos.push(*t); // provisório: vira o fim da nota que vem a seguir (ver `fecha_asterisco`)
                    est.asteriscos_pendentes.push(est.asteriscos.len() - 1);
                }
            }
            "endTuplet" => {
                est.tuplos.pop();
            }
            "Rest" => {
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                fecha_asterisco(est, *t, *t + dur);
                *t += dur;
            }
            "Chord" => {
                if e_apojatura(c) {
                    continue;
                }
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                fecha_asterisco(est, *t, *t + dur);
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
                    let sil = filho(l, "text")
                        .map(texto_completo)
                        .filter(|t| !t.is_empty());
                    if let Some(sil) = sil {
                        est.silabas.push(Silaba {
                            t: *t,
                            voz,
                            verso: numero(l, "no").filter(|&v| v < CORO - 1).unwrap_or(0),
                            continua: matches!(texto(l, "syllabic"), Some("begin" | "middle")),
                            quebra_antes: false,
                            texto: sil,
                        });
                    }
                }
                if !notas.is_empty() {
                    est.saida.entry(voz).or_default().push(Acorde {
                        inicio: *t,
                        dur,
                        notas,
                    });
                }
                *t += dur;
            }
            _ => {}
        }
    }
    Ok(())
}

fn registrar(tr: &mut Trilha, inicio: f64, dur: f64, midi: u8, fim_liga: bool, ini_liga: bool) {
    if fim_liga && let Some(i) = tr.pendentes.iter().position(|(m, _)| *m == midi) {
        let (_, idx) = tr.pendentes.remove(i);
        tr.notas[idx].dur += dur;
        if ini_liga {
            tr.pendentes.push((midi, idx));
        }
        return;
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
            .filter(|&i| {
                chave(eventos[i].inicio) <= a && chave(eventos[i].inicio + eventos[i].dur) >= b
            })
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
            let pos = if n > max && max > 1 {
                (r * (n - 1) + (max - 1) / 2) / (max - 1)
            } else {
                r.min(n - 1)
            };
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

/// Palavras que levam inicial maiúscula por reverência (nomes divinos e pronomes de tratamento), e não por começarem um verso.
const REVERENCIAIS: &[&str] = &[
    "Jesus",
    "Deus",
    "Senhor",
    "Cristo",
    "Salvador",
    "Rei",
    "Pai",
    "Mestre",
    "Redentor",
    "Espírito",
    "Santo",
    "Cordeiro",
    "Messias",
    "Ele",
    "Ti",
    "Te",
    "Teu",
    "Teus",
    "Tua",
    "Tuas",
    "Tu",
    "Lhe",
    "Lhes",
    "Seu",
    "Seus",
    "Sua",
    "Suas",
    "Vós",
    "Filho",
    "Jeová",
    "Criador",
    "Consolador",
    "Emanuel",
    "Altíssimo",
];

/// As letras da primeira palavra do texto (sem aspas, parênteses ou números na frente).
fn primeira_palavra(texto: &str) -> String {
    texto
        .chars()
        .skip_while(|c| !c.is_alphabetic())
        .take_while(|c| c.is_alphabetic())
        .collect()
}

/// A palavra que começa na sílaba `i`: ela mais as seguintes da mesma estrofe enquanto a palavra continua ("Je" + "sus").
fn palavra_a_partir(silabas: &[Silaba], i: usize) -> String {
    let mut palavra = silabas[i].texto.clone();
    let mut atual = i;
    while silabas[atual].continua {
        let (verso, t) = (silabas[i].verso, silabas[atual].t);
        match silabas[atual + 1..]
            .iter()
            .position(|x| x.verso == verso && x.t > t + 1e-6)
        {
            Some(d) => {
                atual += 1 + d;
                palavra.push_str(&silabas[atual].texto);
            }
            None => break,
        }
    }
    palavra
}

fn termina_com_pontuacao(linha: &str) -> bool {
    linha
        .trim_end()
        .chars()
        .last()
        .is_some_and(|c| ".;!?:,".contains(c))
}

/// Uma respiração, vista antes da palavra `palavra`, é fim de verso? No hinário impresso a linha acompanha o VERSO do poema, e a
/// partitura respira também no MEIO do verso (entre duas frases musicais): "Alfa beta | Jesus gama;" é uma linha só (exemplo fictício).
/// A pista está no texto: o verso novo começa em maiúscula, e a continuação do verso, em minúscula. Exceção: nome reverencial
/// ("Jesus", "Senhor", "Te"...) é maiúsculo em qualquer lugar, então só começa verso se o trecho anterior terminou em pontuação.
fn comeca_verso(palavra: &str, linha_anterior: &str) -> bool {
    let p = primeira_palavra(palavra);
    if !p.chars().next().is_some_and(char::is_uppercase) {
        return false;
    }
    !(REVERENCIAIS.contains(&p.as_str()) && !termina_com_pontuacao(linha_anterior))
}

/// Pronomes que se ligam ao verbo com hífen ("cantá-lo", "dá-lhe").
const CLITICOS: &[&str] = &["lo", "la", "los", "las", "lhe", "lhes"];

/// Conserta, sílaba a sílaba, os erros de digitação dos arquivos do autor que têm UMA só leitura possível, ANTES de montar as linhas
/// (assim as marcas do karaokê nascem já do texto certo). `silabas` deve estar ordenada pelo tempo. Tudo o que for ambíguo fica para o
/// arquivo de correções (`correcoes.rs`), em que o responsável diz o que é: uma regra "esperta" já trocou "mão" por "mãe".
/// 1. Pronome (-lo, -la, -los, -las, -lhe, -lhes) colado ao verbo que termina em vogal acentuada, sem hífen: ganha o hífen. Aí um "I"
///    maiúsculo no começo do pronome só pode ser um "l" digitado errado ("cantáIo" -> "cantá-lo"); fora desse caso, um "I" no meio
///    da palavra poderia ser "l" ou "i" e não se mexe.
/// 2. "~" literal (o autor o usa como a elisão) vira espaço, como o símbolo de elisão do MuseScore.
fn corrigir_silabas(silabas: &mut [Silaba]) {
    const EPS: f64 = 1e-6;
    for sil in silabas.iter_mut() {
        if sil.texto.contains('~') {
            sil.texto = sil.texto.replace('~', " ");
        }
    }
    /// Por estrofe: a sílaba atual (instante, se continua a palavra, texto) e a do instante anterior (se continua, texto).
    struct Vista {
        anterior: Option<(bool, String)>,
        t: f64,
        continua: bool,
        texto: String,
    }
    let mut estado: BTreeMap<u32, Vista> = BTreeMap::new();
    for sil in silabas.iter_mut() {
        let e = estado.entry(sil.verso).or_insert(Vista {
            anterior: None,
            t: f64::NEG_INFINITY,
            continua: false,
            texto: String::new(),
        });
        if sil.t > e.t + EPS {
            e.anterior = e.t.is_finite().then(|| (e.continua, e.texto.clone()));
        }
        if let Some((true, anterior)) = &e.anterior {
            let mut letras = sil.texto.chars();
            let com_l =
                if letras.next() == Some('I') && letras.next().is_some_and(|c| c.is_lowercase()) {
                    format!("l{}", &sil.texto[1..])
                } else {
                    sil.texto.clone()
                };
            let radical: String = com_l.chars().take_while(|c| c.is_alphabetic()).collect();
            let acentuada = anterior
                .trim_end_matches(|c: char| !c.is_alphabetic())
                .chars()
                .last()
                .is_some_and(|c| "áàâéêíóôú".contains(c));
            if !sil.continua && acentuada && CLITICOS.contains(&radical.as_str()) {
                sil.texto = format!("-{com_l}");
            }
        }
        if sil.t > e.t + EPS {
            e.t = sil.t;
        }
        e.continua = sil.continua;
        e.texto = sil.texto.clone();
    }
}

/// Num hino com final, o texto do trecho final (o coro cantado só na última vez, depois da última estrofe) costuma vir escrito pelo
/// autor sob a estrofe 1, que é a camada que ele já tinha aberta. No hinário impresso ele vem DEPOIS da última estrofe. Então o
/// texto que começa em `t_final` (o início da 2ª casa) e está sob uma estrofe que não é a última passa para a última estrofe.
/// Só se mexe quando esse texto está todo sob UMA estrofe: com mais de uma, não há como saber a qual cada trecho pertence.
fn coro_para_a_ultima_estrofe(silabas: &mut [Silaba], t_final: f64) {
    const EPS: f64 = 1e-6;
    let Some(ultima) = silabas.iter().map(|s| s.verso).max() else {
        return;
    };
    let origem: BTreeSet<u32> = silabas
        .iter()
        .filter(|s| s.t >= t_final - EPS && s.verso != ultima)
        .map(|s| s.verso)
        .collect();
    if origem.len() == 1 {
        for sil in silabas
            .iter_mut()
            .filter(|s| s.t >= t_final - EPS && s.verso != ultima)
        {
            sil.verso = ultima;
        }
    }
}

/// O último instante em que mais de uma estrofe canta ao mesmo tempo (`None` se nunca). Depois dele não há mais estrofes: o que
/// sobra é refrão. Sílaba sem nenhuma letra (um "'" solto, por exemplo) não conta como estrofe cantando.
fn ultimo_instante_com_estrofes_juntas(silabas: &[Silaba]) -> Option<f64> {
    const EPS: f64 = 1e-6;
    let com_letra = |s: &&Silaba| s.texto.chars().any(char::is_alphabetic);
    silabas
        .iter()
        .filter(com_letra)
        .filter(|a| {
            silabas
                .iter()
                .filter(com_letra)
                .any(|b| b.verso != a.verso && (a.t - b.t).abs() < EPS)
        })
        .map(|s| s.t)
        .fold(None, |m: Option<f64>, t| Some(m.map_or(t, |x| x.max(t))))
}

/// Marcador interno do coro (refrão): não é número de estrofe. Na letra vira o parágrafo "Coro. ..." e na sincronia, a estrofe 0.
const CORO: u32 = u32::MAX - 1;
/// Com menos sílabas que isto depois das estrofes, o resto não é refrão: é o fim de uma estrofe escrito só uma vez (hinos 61, 62, 189...).
const SILABAS_MINIMAS_DO_CORO: usize = 6;

/// Separa o refrão: tudo o que é cantado depois do último instante com estrofes juntas vira o **coro**, um bloco à parte da
/// estrofe 1, como no hinário impresso. Só vale com pelo menos `SILABAS_MINIMAS_DO_CORO` sílabas com letra. Devolve quantas.
fn separar_o_coro(silabas: &mut [Silaba]) -> usize {
    const EPS: f64 = 1e-6;
    let Some(corte) = ultimo_instante_com_estrofes_juntas(silabas) else {
        return 0;
    };
    let com_letra = |s: &Silaba| s.texto.chars().any(char::is_alphabetic);
    // A mesma sílaba escrita em duas vozes (mesmo instante e texto) conta uma vez só, como na letra pronta.
    let cauda: BTreeSet<(u64, &str)> = silabas
        .iter()
        .filter(|s| s.t > corte + EPS && com_letra(s))
        .map(|s| (s.t.to_bits(), s.texto.as_str()))
        .collect();
    if cauda.len() < SILABAS_MINIMAS_DO_CORO {
        return 0;
    }
    // O resto tem de estar numa estrofe só, e não na de maior número: aí seria só a última estrofe, mais longa que as outras.
    let donos: BTreeSet<u32> = silabas
        .iter()
        .filter(|s| s.t > corte + EPS && com_letra(s))
        .map(|s| s.verso)
        .collect();
    let maior = silabas
        .iter()
        .filter(|s| com_letra(s))
        .map(|s| s.verso)
        .max();
    if donos.len() != 1 || donos.first().copied() == maior {
        return 0;
    }
    let dono = *donos.first().unwrap();
    // Se o corte cai no meio de uma palavra da estrofe (a sílaba anterior "continua"), o pedaço que falta fica nela.
    let mut daestrofe: Vec<usize> = (0..silabas.len())
        .filter(|&i| silabas[i].verso == dono && com_letra(&silabas[i]))
        .collect();
    daestrofe.sort_by(|&a, &b| silabas[a].t.total_cmp(&silabas[b].t));
    let mut inicio = daestrofe.iter().position(|&i| silabas[i].t > corte + EPS);
    while let Some(k) = inicio {
        if k > 0 && silabas[daestrofe[k - 1]].continua {
            inicio = (k + 1 < daestrofe.len()).then_some(k + 1);
        } else {
            break;
        }
    }
    let Some(inicio) = inicio else {
        return 0;
    };
    let t_inicio = silabas[daestrofe[inicio]].t;
    let n = silabas
        .iter()
        .filter(|s| s.t >= t_inicio - EPS && s.verso == dono && com_letra(s))
        .count();
    if n < SILABAS_MINIMAS_DO_CORO {
        return 0;
    }
    for s in silabas.iter_mut().filter(|s| s.t >= t_inicio - EPS) {
        s.verso = CORO;
    }
    n
}

/// Refrão (coro) escrito depois das estrofes, numa camada só, mas com o número de estrofe errado nas primeiras sílabas (visto nos hinos
/// 5, 7, 10, 16 e 28 do hinário 5: "A Ro cha" marcado como estrofe 2 e o resto do refrão como estrofe 1). Depois do ÚLTIMO instante em
/// que mais de uma estrofe canta ao mesmo tempo, não há mais estrofes: o que sobra é refrão e é de uma estrofe só. Se esse resto
/// aparece com mais de um número de estrofe, todo ele passa para o que tem mais sílabas (empate: o menor número). Se o resto já está
/// sob uma estrofe só, ou se não há instante com estrofes juntas, nada muda. Devolve quantas sílabas mudaram de estrofe.
fn refrao_com_estrofe_trocada(silabas: &mut [Silaba]) -> usize {
    const EPS: f64 = 1e-6;
    let Some(corte) = ultimo_instante_com_estrofes_juntas(silabas) else {
        return 0;
    };
    let mut contagem: BTreeMap<u32, usize> = BTreeMap::new();
    for s in silabas
        .iter()
        .filter(|s| s.t > corte + EPS && s.texto.chars().any(char::is_alphabetic))
    {
        *contagem.entry(s.verso).or_insert(0) += 1;
    }
    if contagem.len() < 2 {
        return 0;
    }
    let (alvo, _) = contagem.iter().fold(
        (0, 0),
        |(av, ac), (&v, &c)| if c > ac { (v, c) } else { (av, ac) },
    );
    let mut mudaram = 0;
    for s in silabas
        .iter_mut()
        .filter(|s| s.t > corte + EPS && s.verso != alvo)
    {
        s.verso = alvo;
        mudaram += 1;
    }
    mudaram
}

/// Monta a letra a partir das sílabas, **ordenadas pelo tempo da nota** (e não pela ordem no
/// arquivo, onde as camadas de uma pauta vêm uma depois da outra). Cada estrofe (`<no>`,
/// 0 = primeira) vira uma sequência de linhas, com quebra nas respirações que terminam um VERSO
/// (ver `comeca_verso`). Se a estrofe não tem pelo menos duas respirações seguidas de maiúscula
/// (o autor escreveu tudo em minúscula), não há como distinguir e vale a quebra a cada respiração.
/// Estrofes são separadas por uma linha vazia e a primeira linha de cada uma leva "N. ". Se duas
/// camadas trazem sílaba para o mesmo instante e estrofe, vale a da voz mais alta (menor número).
fn montar_letra(mut silabas: Vec<Silaba>, mut respiracoes: Vec<f64>) -> (Vec<String>, Vec<Marca>) {
    const EPS: f64 = 1e-6;
    silabas.sort_by(|a, b| a.t.total_cmp(&b.t).then(a.voz.cmp(&b.voz)));
    respiracoes.sort_by(|a, b| a.total_cmp(b));
    corrigir_silabas(&mut silabas);

    // Pré-passo: a palavra que cada sílaba abre e, por estrofe, quantas respirações são seguidas de maiúscula. Só com duas ou
    // mais a maiúscula vale como pista de começo de verso.
    let palavras: Vec<String> = (0..silabas.len())
        .map(|i| palavra_a_partir(&silabas, i))
        .collect();
    let mut vistas: BTreeMap<u32, usize> = BTreeMap::new();
    let mut maiusculas: BTreeMap<u32, usize> = BTreeMap::new();
    for (i, sil) in silabas.iter().enumerate() {
        let quebras = respiracoes.iter().filter(|&&r| r <= sil.t + EPS).count();
        let vista = vistas.entry(sil.verso).or_insert(0);
        if quebras > *vista {
            *vista = quebras;
            // Mesma condição de `comeca_verso`, sem a linha anterior (ainda não existe): nome reverencial não é pista.
            if comeca_verso(&palavras[i], "") {
                *maiusculas.entry(sil.verso).or_insert(0) += 1;
            }
        }
    }

    struct Estrofe {
        linhas: Vec<String>,
        espaco: bool,
        quebra_vista: usize,
        ultimo_t: f64,
        ultimo_texto: String,
        ultima_voz: usize,
    }
    let mut estrofes: BTreeMap<u32, Estrofe> = BTreeMap::new();
    let mut marcas: Vec<Marca> = vec![];

    for (i, sil) in silabas.into_iter().enumerate() {
        let e = estrofes.entry(sil.verso).or_insert_with(|| Estrofe {
            linhas: vec![String::new()],
            espaco: false,
            quebra_vista: 0,
            ultimo_t: f64::NEG_INFINITY,
            ultimo_texto: String::new(),
            ultima_voz: usize::MAX,
        });
        // Só é duplicata a MESMA sílaba, no mesmo instante, vinda de OUTRA camada. Duas sílabas diferentes no
        // mesmo instante (ou na mesma camada) são texto de verdade e ficam.
        if (sil.t - e.ultimo_t).abs() < EPS
            && sil.voz != e.ultima_voz
            && sil.texto == e.ultimo_texto
        {
            continue;
        }
        e.ultimo_t = sil.t;
        e.ultimo_texto = sil.texto.clone();
        e.ultima_voz = sil.voz;
        // O autor às vezes escreve o número da estrofe dentro da primeira sílaba ("1. Pa"): o app já numera.
        let primeira = e.linhas.iter().all(|l| l.is_empty());
        let texto = if primeira {
            sem_numero_inicial(&sil.texto)
        } else {
            sil.texto.as_str()
        };
        if texto.is_empty() {
            continue;
        }
        if sil.quebra_antes && !e.linhas.last().is_some_and(|l| l.is_empty()) {
            e.linhas.push(String::new());
            e.espaco = false;
        }
        let quebras = respiracoes.iter().filter(|&&r| r <= sil.t + EPS).count();
        if quebras > e.quebra_vista {
            e.quebra_vista = quebras;
            let regra_do_verso = maiusculas.get(&sil.verso).copied().unwrap_or(0) >= 2;
            let anterior = e.linhas.last().map(String::as_str).unwrap_or("");
            let quebrar = !regra_do_verso || comeca_verso(&palavras[i], anterior);
            if quebrar && !e.linhas.last().is_some_and(|l| l.is_empty()) {
                e.linhas.push(String::new());
                e.espaco = false;
            }
        }
        // Linhas vazias só podem sobrar no fim (uma quebra nunca abre linha sobre linha vazia), então o índice daqui
        // é o mesmo da linha na letra pronta.
        let indice = e.linhas.len() - 1;
        let linha = e.linhas.last_mut().unwrap();
        if e.espaco && !linha.is_empty() {
            linha.push(' ');
        }
        // Posições em unidades UTF-16: é como o JavaScript do app indexa o texto.
        let de = linha.encode_utf16().count();
        linha.push_str(texto);
        marcas.push(Marca {
            verso: sil.verso,
            linha: indice,
            de,
            ate: de + texto.encode_utf16().count(),
            t: sil.t,
        });
        e.espaco = !sil.continua;
    }

    // O coro vem logo depois da primeira estrofe, como no hinário impresso.
    let mut ordem: Vec<(u32, Estrofe)> = estrofes.into_iter().collect();
    if let Some(p) = ordem.iter().position(|(v, _)| *v == CORO) {
        let coro = ordem.remove(p);
        ordem.insert(1.min(ordem.len()), coro);
    }
    let mut saida = vec![];
    for (verso, e) in ordem {
        if !saida.is_empty() {
            saida.push(String::new());
        }
        for (i, l) in e.linhas.into_iter().filter(|l| !l.is_empty()).enumerate() {
            saida.push(if i == 0 && verso == CORO {
                format!("Coro. {l}")
            } else if i == 0 {
                format!("{}. {l}", verso + 1)
            } else {
                l
            });
        }
    }
    (saida, marcas)
}

/// Instante da partitura na régua de uma passada (as notas dela, sem buracos), ou `None` se esse trecho não toca nela.
fn instante_na_passada(t: f64, segmentos: &[(usize, usize)], inicios: &[f64]) -> Option<f64> {
    const EPS: f64 = 1e-6;
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let (t0, t1) = (inicios[de], inicios[ate]);
        if t >= t0 - EPS && t < t1 - EPS {
            return Some(t - t0 + acumulado);
        }
        acumulado += t1 - t0;
    }
    None
}

/// Agrupa as marcas por estrofe e linha, com o tempo na régua da passada. Estrofes sem nenhum trecho nessa passada
/// ficam de fora; linhas sem trecho ficam vazias (o índice continua o da letra).
fn estrofes_da_passada(
    marcas: &[Marca],
    segmentos: &[(usize, usize)],
    inicios: &[f64],
) -> Vec<EstrofeSinc> {
    let mut linhas_por_verso: BTreeMap<u32, usize> = BTreeMap::new();
    for m in marcas {
        let n = linhas_por_verso.entry(m.verso).or_insert(0);
        *n = (*n).max(m.linha + 1);
    }
    let mut saida = vec![];
    for (&verso, &n_linhas) in &linhas_por_verso {
        let mut linhas: Vec<Vec<Trecho>> = vec![vec![]; n_linhas];
        let mut algum = false;
        for m in marcas.iter().filter(|m| m.verso == verso) {
            if let Some(t) = instante_na_passada(m.t, segmentos, inicios) {
                linhas[m.linha].push((arredondar(t), m.de, m.ate));
                algum = true;
            }
        }
        if algum {
            saida.push(EstrofeSinc {
                estrofe: if verso == CORO { 0 } else { verso + 1 },
                linhas,
            });
        }
    }
    saida
}

/// Todo o texto dentro de um elemento, sem espaços repetidos. Entende o texto rico do MuseScore:
/// - trechos com formatação (`<i>`, `<b>`...) entram inteiros;
/// - o símbolo de **elisão** (`<sym>lyricsElision...</sym>`, duas palavras cantadas numa nota só,
///   como "go‿es") vira um espaço: "go es";
/// - o nome de qualquer outro símbolo (`<sym>...</sym>`) é ignorado, para não vazar no texto.
fn texto_completo(n: Node) -> String {
    let mut s = String::new();
    for d in n.descendants() {
        if d.is_text() {
            if d.parent().is_some_and(|p| p.has_tag_name("sym")) {
                continue; // nome do símbolo, não é texto
            }
            s.push_str(d.text().unwrap_or(""));
        } else if d.has_tag_name("sym")
            && d.text()
                .is_some_and(|t| t.trim().starts_with("lyricsElision"))
        {
            s.push(' ');
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Tira um número de estrofe escrito no começo do texto ("1. Pa" -> "Pa"): o app já numera as estrofes.
fn sem_numero_inicial(s: &str) -> &str {
    let t = s.trim_start();
    let digitos = t.chars().take_while(|c| c.is_ascii_digit()).count();
    match t[digitos..].strip_prefix('.') {
        Some(resto) if digitos > 0 => resto.trim_start(),
        _ => s,
    }
}

/// Textos de moldura (`<Text>` com `<style>` igual a um dos estilos pedidos), na ordem do arquivo.
fn texto_de_estilo(doc: &Document, estilos: &[&str]) -> Vec<String> {
    let mut achados: Vec<(usize, String)> = vec![];
    for n in doc.descendants().filter(|n| n.has_tag_name("Text")) {
        let Some(estilo) = texto(n, "style") else {
            continue;
        };
        let Some(pos) = estilos.iter().position(|e| *e == estilo) else {
            continue;
        };
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
    // As vozes da passada do final precisam ter os mesmos nomes das da passada normal.
    for v in h
        .vozes
        .iter_mut()
        .chain(h.passada_final.iter_mut().flatten())
        .chain(h.introducao.iter_mut().flatten())
    {
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

/// Marcas de repetição lidas da primeira pauta (índices de compasso começam em 0).
#[derive(Default)]
struct Estrutura {
    /// Instante, em batidas, em que cada compasso começa; o último valor é o fim da partitura.
    inicios: Vec<f64>,
    inicio_repeticao: Option<usize>,
    fim_repeticao: Option<usize>,
    /// Casas de volta: (primeiro compasso, compasso onde termina, exclusivo).
    voltas: Vec<(usize, Option<usize>)>,
    ids_volta: Vec<String>,
}

fn registrar_marcas(est: &mut Estrutura, compasso: Node, ci: usize) {
    for n in compasso.descendants() {
        match n.tag_name().name() {
            "startRepeat" => est.inicio_repeticao = Some(ci),
            "endRepeat" => est.fim_repeticao = Some(ci),
            "Volta" => {
                est.voltas.push((ci, None));
                est.ids_volta
                    .push(n.attribute("id").unwrap_or("").to_string());
            }
            // O colchete da volta termina no começo do compasso onde aparece o seu endSpanner.
            "endSpanner" => {
                if let Some(i) = n
                    .attribute("id")
                    .and_then(|id| est.ids_volta.iter().position(|v| v == id))
                {
                    est.voltas[i].1 = Some(ci);
                }
            }
            _ => {}
        }
    }
}

/// Quais compassos (intervalos `[de, até)`) tocam na passada normal e na passada do final.
struct Plano {
    normal: Vec<(usize, usize)>,
    final_: Vec<(usize, usize)>,
    descricao: String,
}

/// Reconhece o padrão dos hinos com final, confirmado pelo responsável no hino 457:
///   início de repetição no começo · compasso com fim de repetição e 1ª casa de volta · 2ª casa de volta
///   logo depois · trecho final até o fim da partitura.
/// Passada normal = do começo até o fim da 1ª casa. Passada do final = do começo até antes da 1ª casa,
/// depois a 2ª casa e tudo o que vem a seguir. Qualquer outra estrutura devolve `None`.
fn plano_passadas(e: &Estrutura) -> Option<Plano> {
    let n = e.inicios.len().checked_sub(1)?;
    if e.voltas.len() != 2 {
        return None;
    }
    let ((a1, f1), (a2, f2)) = (e.voltas[0], e.voltas[1]);
    let (f1, f2) = (f1?, f2?);
    let fim_rep = e.fim_repeticao?;
    if f1 != a2 || fim_rep + 1 != f1 || f2 > n || e.inicio_repeticao.unwrap_or(0) != 0 {
        return None;
    }
    Some(Plano {
        normal: vec![(0, f1)],
        final_: vec![(0, a1), (a2, n)],
        descricao: format!(
            "passada normal = compassos 1 a {f1}; passada do final = compassos 1 a {a1} e {} a {n}",
            a2 + 1
        ),
    })
}

/// Recorta os acordes que começam em cada intervalo de compassos e os recoloca em sequência, sem buracos.
fn selecionar(acordes: &[Acorde], inicios: &[f64], segmentos: &[(usize, usize)]) -> Vec<Acorde> {
    const EPS: f64 = 1e-6;
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let (t0, t1) = (inicios[de], inicios[ate]);
        for a in acordes
            .iter()
            .filter(|a| a.inicio >= t0 - EPS && a.inicio < t1 - EPS)
        {
            let mut novo = a.clone();
            novo.inicio = a.inicio - t0 + acumulado;
            novo.dur = a.dur.min(t1 - a.inicio);
            saida.push(novo);
        }
        acumulado += t1 - t0;
    }
    saida
}

/// O instante em que cada compasso dos `segmentos` começa na passada montada por `selecionar`: o mesmo deslocamento de cada intervalo
/// (`inicio - t0 + acumulado`), para o compasso cair exatamente onde as suas notas caem. Os índices são os do compasso ESCRITO.
fn compassos_da_passada(inicios: &[f64], segmentos: &[(usize, usize)]) -> Vec<InicioDeCompasso> {
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let t0 = inicios[de];
        for (i, &inicio) in inicios.iter().enumerate().take(ate).skip(de) {
            saida.push((arredondar(inicio - t0 + acumulado), i));
        }
        acumulado += inicios[ate] - t0;
    }
    saida
}

/// Os compassos da introdução: os que começam antes do marcador `*` (`fim_intro`, em batidas). O compasso que contém o `*` entra, porque
/// começa antes dele. A introdução é o começo da passada normal, então a régua é a mesma.
fn compassos_da_introducao(inicios: &[f64], fim_intro: f64) -> Vec<InicioDeCompasso> {
    const EPS: f64 = 1e-6;
    (0..inicios.len().saturating_sub(1))
        .take_while(|&i| inicios[i] < fim_intro - EPS)
        .map(|i| (arredondar(inicios[i]), i))
        .collect()
}

pub fn converter(xml: &str, numero_hino: u32) -> Result<Hino, String> {
    converter_com(xml, numero_hino, &[])
}

/// Como `converter`, aplicando antes as correções da letra desse hino (arquivo de correções; ver `correcoes.rs`).
pub fn converter_com(
    xml: &str,
    numero_hino: u32,
    ajustes: &[correcoes::Correcao],
) -> Result<Hino, String> {
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
        let pautas: Vec<_> = parte
            .children()
            .filter(|c| c.has_tag_name("Staff"))
            .collect();
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
    let mut vozes_final: Vec<Voz> = vec![];
    let mut final_ok = true;
    let mut avisos: Vec<String> = vec![];
    let mut letra: Vec<String> = vec![];
    let mut marcas: Vec<Marca> = vec![];
    let mut andamento = None;
    let mut estrutura = Estrutura::default();
    let mut plano: Option<Plano> = None;
    let mut asteriscos: Vec<f64> = vec![];
    let mut correcoes_tentadas = false;

    let pautas = score
        .children()
        .filter(|c| c.has_tag_name("Staff") && c.children().any(|m| m.has_tag_name("Measure")));
    for (idx_pauta, pauta) in pautas.enumerate() {
        let id = pauta.attribute("id").unwrap_or("?");
        let (nome_parte, pos_pauta, total) = info.get(id).cloned().unwrap_or((String::new(), 1, 1));
        let (mut sig_n, mut sig_d) = (4.0f64, 4.0f64);
        let mut inicio_compasso = 0.0;
        let mut da_pauta: BTreeMap<usize, Vec<Acorde>> = BTreeMap::new();
        let mut silabas: Vec<Silaba> = vec![];
        let mut respiracoes: Vec<f64> = vec![];

        for (ci, compasso) in pauta
            .children()
            .filter(|c| c.has_tag_name("Measure"))
            .enumerate()
        {
            // A estrutura de repetição é lida só da primeira pauta (as outras repetem as mesmas marcas).
            if idx_pauta == 0 {
                estrutura.inicios.push(inicio_compasso);
                registrar_marcas(&mut estrutura, compasso, ci);
            }
            if let Some(ts) = compasso.descendants().find(|n| n.has_tag_name("TimeSig"))
                && let (Some(n), Some(d)) = (numero::<f64>(ts, "sigN"), numero::<f64>(ts, "sigD"))
            {
                (sig_n, sig_d) = (n, d);
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
            for (k, v) in compasso
                .children()
                .filter(|c| c.has_tag_name("voice"))
                .enumerate()
            {
                fontes.push((k + desloc, false, v));
            }

            for (voz, plano, no) in fontes {
                let mut asteriscos_pendentes: Vec<usize> = vec![]; // por compasso e voz: um "*" sem nota depois dele vale o fim da nota anterior
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
                    asteriscos: &mut asteriscos,
                    asteriscos_pendentes: &mut asteriscos_pendentes,
                };
                let mut t = inicio_compasso;
                percorrer(no, &mut t, &mut est)?;
                andamento = est.andamento;
            }
            inicio_compasso += comp;
        }

        if idx_pauta == 0 {
            estrutura.inicios.push(inicio_compasso); // fim da partitura
            plano = plano_passadas(&estrutura);
        }

        if letra.is_empty() && !silabas.is_empty() {
            correcoes_tentadas = true;
            avisos.extend(correcoes::aplicar(&mut silabas, numero_hino, ajustes));
            if let Some(&(a2, _)) = plano.as_ref().and_then(|p| p.final_.last()) {
                coro_para_a_ultima_estrofe(&mut silabas, estrutura.inicios[a2]);
            } else {
                let n = refrao_com_estrofe_trocada(&mut silabas);
                let coro = separar_o_coro(&mut silabas);
                if coro > 0 {
                    avisos.push(format!(
                        "coro separado: {coro} sílabas depois das estrofes viraram o bloco \"Coro\""
                    ));
                }
                if n > 0 && coro == 0 {
                    avisos.push(format!(
                        "refrão com estrofe trocada: {n} sílabas do refrão (depois das estrofes) passaram para a estrofe do restante do refrão"
                    ));
                }
            }
            (letra, marcas) = montar_letra(silabas, respiracoes);
        }
        let base = if nome_parte.is_empty() {
            format!("Voz {id}")
        } else {
            nome_parte.clone()
        };
        let sufixo = if total > 1 {
            format!(" (pauta {pos_pauta})")
        } else {
            String::new()
        };
        let partes: Vec<&str> = base.split(" e ").collect();
        let limite = (partes.len() > 1).then_some(partes.len());
        let camadas: Vec<Vec<Acorde>> = da_pauta.into_values().collect();
        // Com o padrão de final reconhecido, geramos as notas da passada normal e as da passada do final.
        let (normal, final_) = match &plano {
            Some(p) => (
                camadas
                    .iter()
                    .map(|c| selecionar(c, &estrutura.inicios, &p.normal))
                    .collect::<Vec<_>>(),
                Some(
                    camadas
                        .iter()
                        .map(|c| selecionar(c, &estrutura.inicios, &p.final_))
                        .collect::<Vec<_>>(),
                ),
            ),
            None => (camadas, None),
        };
        let nome_da_voz = |r: usize, max: usize| -> String {
            if max == 1 {
                format!("{base}{sufixo}")
            } else if partes.len() == max {
                format!("{}{sufixo}", nome_da_parte(&partes, r))
            } else {
                format!("{base}{sufixo} ({})", r + 1)
            }
        };

        let (linhas, omitidos) = dividir_em_vozes(normal, limite);
        if omitidos > 0 {
            avisos.push(format!(
                "{base}{sufixo}: {omitidos} trecho(s) com mais notas simultâneas que vozes; notas do meio omitidas"
            ));
        }
        let max = linhas.len();
        for (r, notas) in linhas.into_iter().enumerate() {
            vozes.push(Voz {
                nome: nome_da_voz(r, max),
                notas,
            });
        }

        if let Some(fc) = final_ {
            let (linhas_f, omitidos_f) = dividir_em_vozes(fc, limite);
            if omitidos_f > 0 {
                avisos.push(format!(
                    "{base}{sufixo} (passada do final): {omitidos_f} trecho(s) com mais notas simultâneas que vozes; notas do meio omitidas"
                ));
            }
            if linhas_f.len() == max {
                for (r, notas) in linhas_f.into_iter().enumerate() {
                    vozes_final.push(Voz {
                        nome: nome_da_voz(r, max),
                        notas,
                    });
                }
            } else {
                // As vozes do final precisam corresponder uma a uma às da passada normal.
                final_ok = false;
                avisos.push(format!(
                    "{base}{sufixo}: a passada do final tem {} voz(es) e a normal {max}; o final foi descartado",
                    linhas_f.len()
                ));
            }
        }
    }

    if !ajustes.is_empty() && !correcoes_tentadas {
        avisos.push(format!(
            "hino {numero_hino}: {} correção(ões) da letra NÃO aplicada(s), porque a partitura não tem letra",
            ajustes.len()
        ));
    }
    if let Some(p) = &plano {
        avisos.push(format!(
            "estrutura de repetição reconhecida: {}",
            p.descricao
        ));
    } else if doc.descendants().any(|n| {
        matches!(
            n.tag_name().name(),
            "startRepeat" | "endRepeat" | "Jump" | "Volta"
        )
    }) {
        avisos.push(
            "há repetições/saltos numa estrutura não reconhecida: a partitura é lida uma vez, em ordem".to_string(),
        );
    }
    let passada_final = (final_ok && !vozes_final.is_empty()).then_some(vozes_final);

    // Sincronia da letra (karaokê): o instante de cada sílaba na régua de cada passada. A passada normal toca os
    // compassos do plano (ou a partitura toda, sem plano); a do final, só quando o final foi aceito.
    let sincronia = if marcas.is_empty() || estrutura.inicios.len() < 2 {
        None
    } else {
        let todos = [(0, estrutura.inicios.len() - 1)];
        let normal_seg: &[(usize, usize)] = plano.as_ref().map_or(&todos, |p| &p.normal);
        let normal = estrofes_da_passada(&marcas, normal_seg, &estrutura.inicios);
        let final_ = plano
            .as_ref()
            .filter(|_| passada_final.is_some())
            .map(|p| estrofes_da_passada(&marcas, &p.final_, &estrutura.inicios))
            .filter(|f| !f.is_empty());
        (!normal.is_empty()).then_some(Sincronia {
            normal,
            passada_final: final_,
        })
    };

    // Introdução: do começo até o fim da nota que leva o primeiro "*" (o autor o escreve sobre a última nota da introdução, que fecha com a
    // respiração). Sai das vozes já montadas, então tem as mesmas vozes, na mesma ordem.
    let fim_intro = asteriscos.iter().copied().fold(f64::INFINITY, f64::min);
    let introducao = if fim_intro.is_finite() && fim_intro > 0.0 {
        let intro = recortar_inicio(&vozes, fim_intro);
        if intro.is_some() {
            avisos.push(format!(
                "introdução: do começo até o marcador * ({} batidas)",
                arredondar(fim_intro)
            ));
        }
        intro
    } else {
        None
    };

    // Compassos de cada fluxo (I-12, fase B): a passada normal toca os compassos do plano (ou a partitura toda, sem plano); a do final, só quando
    // o final foi aceito; a introdução, os que começam antes do "*". Mesma régua das notas das vozes de cada fluxo.
    let compassos = if estrutura.inicios.len() < 2 {
        None
    } else {
        let todos = [(0, estrutura.inicios.len() - 1)];
        let normal_seg: &[(usize, usize)] = plano.as_ref().map_or(&todos, |p| &p.normal);
        Some(Compassos {
            normal: compassos_da_passada(&estrutura.inicios, normal_seg),
            passada_final: plano
                .as_ref()
                .filter(|_| passada_final.is_some())
                .map(|p| compassos_da_passada(&estrutura.inicios, &p.final_)),
            introducao: introducao
                .as_ref()
                .map(|_| compassos_da_introducao(&estrutura.inicios, fim_intro)),
        })
    };

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

    let (armadura, modo_escrito, aviso_armadura) = ler_armadura(&doc);
    avisos.extend(aviso_armadura);
    let modo = modo_escrito
        .or_else(|| modo_pelo_baixo(armadura, &vozes, passada_final.as_deref()))
        .unwrap_or_else(|| {
            avisos.push(format!(
                "tonalidade: o baixo não termina na tônica de {}; assumido maior",
                nome_da_tonalidade(armadura, "maior")
            ));
            "maior"
        });

    Ok(Hino {
        numero: numero_hino,
        titulo,
        autoria,
        andamento,
        armadura,
        modo,
        vozes,
        passada_final,
        introducao,
        letra,
        sincronia,
        compassos,
        avisos,
    })
}

/// Armadura e modo escrito (se houver) do primeiro `KeySig` da partitura. MuseScore 2 e 3 gravam `<accidental>`; o 4 pode gravar
/// `<concertKey>` e `<mode>` (não confirmado: aceita o que existir). Modulações no meio da peça são ignoradas.
fn ler_armadura(doc: &Document) -> (i8, Option<&'static str>, Option<String>) {
    let Some(ks) = doc.descendants().find(|n| n.has_tag_name("KeySig")) else {
        return (0, None, None);
    };
    let modo = match texto(ks, "mode")
        .map(|m| m.trim().to_lowercase())
        .as_deref()
    {
        Some("major" | "maior" | "ionian") => Some("maior"),
        Some("minor" | "menor" | "aeolian") => Some("menor"),
        _ => None,
    };
    // Sem o número, a armadura é 0 (o MuseScore pode omitir o 0); com o número inválido, vira 0 COM aviso.
    let bruto = ["accidental", "concertKey"]
        .iter()
        .find_map(|n| filho(ks, n).and_then(|x| x.text()).map(str::trim));
    let Some(bruto) = bruto else {
        return (0, modo, None);
    };
    match bruto.parse::<i64>() {
        Ok(a) if (-7..=7).contains(&a) => (a as i8, modo, None),
        _ => (
            0,
            modo,
            Some(format!(
                "tonalidade: armadura inválida ({bruto}); assumido 0"
            )),
        ),
    }
}

/// Classe de nota (0 = Dó) da tônica da tonalidade maior com essa armadura, ou da relativa menor.
fn tonica_pc(armadura: i8, menor: bool) -> u8 {
    let maior = (i32::from(armadura) * 7).rem_euclid(12);
    (if menor { maior + 9 } else { maior }).rem_euclid(12) as u8
}

/// Última nota (a que começa mais tarde) de uma voz.
fn ultima_nota(v: &Voz) -> Option<u8> {
    v.notas
        .iter()
        .max_by(|a, b| a.inicio.total_cmp(&b.inicio))
        .map(|n| n.midi)
}

/// Modo pela nota final do baixo (última voz): da passada final, se houver, senão da normal; se não bater com nenhuma tônica,
/// pela primeira nota do baixo. `None` quando nada bate (o chamador assume maior e avisa).
fn modo_pelo_baixo(armadura: i8, vozes: &[Voz], final_: Option<&[Voz]>) -> Option<&'static str> {
    let qual = |pc: u8| {
        if pc == tonica_pc(armadura, false) {
            Some("maior")
        } else if pc == tonica_pc(armadura, true) {
            Some("menor")
        } else {
            None
        }
    };
    let fim = final_
        .and_then(<[Voz]>::last)
        .or(vozes.last())
        .and_then(ultima_nota);
    let inicio = vozes
        .last()
        .and_then(|v| v.notas.iter().min_by(|a, b| a.inicio.total_cmp(&b.inicio)))
        .map(|n| n.midi);
    fim.and_then(|m| qual(m % 12))
        .or_else(|| inicio.and_then(|m| qual(m % 12)))
}

const NOMES_MAIOR: [&str; 15] = [
    "Dó♭", "Sol♭", "Ré♭", "Lá♭", "Mi♭", "Si♭", "Fá", "Dó", "Sol", "Ré", "Lá", "Mi", "Si", "Fá♯",
    "Dó♯",
];
const NOMES_MENOR: [&str; 15] = [
    "Lá♭", "Mi♭", "Si♭", "Fá", "Dó", "Sol", "Ré", "Lá", "Mi", "Si", "Fá♯", "Dó♯", "Sol♯", "Ré♯",
    "Lá♯",
];

/// Nome da tonalidade em português ("Mi♭ maior"), pelo nome da armadura (não da tônica: +6 é Fá♯, −6 é Sol♭).
pub fn nome_da_tonalidade(armadura: i8, modo: &str) -> String {
    let i = (i32::from(armadura) + 7).clamp(0, 14) as usize;
    if modo == "menor" {
        format!("{} menor", NOMES_MENOR[i])
    } else {
        format!("{} maior", NOMES_MAIOR[i])
    }
}

/// Recorta o começo de cada voz, até `ate` batidas: notas que começam antes entram, e as que atravessam o corte
/// são encurtadas. Devolve `None` se não sobrar nenhuma nota.
fn recortar_inicio(vozes: &[Voz], ate: f64) -> Option<Vec<Voz>> {
    const EPS: f64 = 1e-6;
    let recorte: Vec<Voz> = vozes
        .iter()
        .map(|v| Voz {
            nome: v.nome.clone(),
            notas: v
                .notas
                .iter()
                .filter(|n| n.inicio < ate - EPS)
                .map(|n| Evento {
                    inicio: n.inicio,
                    dur: n.dur.min(ate - n.inicio),
                    midi: n.midi,
                })
                .collect(),
        })
        .collect();
    recorte
        .iter()
        .any(|v| !v.notas.is_empty())
        .then_some(recorte)
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
    m.insert("armadura".into(), json!(h.armadura));
    m.insert("modo".into(), json!(h.modo));
    m.insert(
        "tonalidade".into(),
        json!(nome_da_tonalidade(h.armadura, h.modo)),
    );
    if !h.letra.is_empty() {
        m.insert("letra".into(), json!(h.letra));
    }
    m.insert("vozes".into(), Value::Array(vozes_json(&h.vozes)));
    if let Some(f) = &h.passada_final {
        m.insert("final".into(), json!({ "vozes": vozes_json(f) }));
    }
    if let Some(i) = &h.introducao {
        m.insert("introducao".into(), json!({ "vozes": vozes_json(i) }));
    }
    if let Some(s) = &h.sincronia {
        let mut o = Map::new();
        o.insert("normal".into(), json!(estrofes_json(&s.normal)));
        if let Some(f) = &s.passada_final {
            o.insert("final".into(), json!(estrofes_json(f)));
        }
        m.insert("sincronia".into(), Value::Object(o));
    }
    if let Some(c) = &h.compassos {
        let mut o = Map::new();
        o.insert("normal".into(), json!(c.normal));
        if let Some(f) = &c.passada_final {
            o.insert("final".into(), json!(f));
        }
        if let Some(i) = &c.introducao {
            o.insert("introducao".into(), json!(i));
        }
        m.insert("compassos".into(), Value::Object(o));
    }
    Value::Object(m)
}

fn estrofes_json(estrofes: &[EstrofeSinc]) -> Vec<Value> {
    estrofes
        .iter()
        .map(|e| json!({ "estrofe": e.estrofe, "linhas": e.linhas }))
        .collect()
}

fn vozes_json(vozes: &[Voz]) -> Vec<Value> {
    vozes
        .iter()
        .map(|v| {
            let notas: Vec<Value> = v
                .notas
                .iter()
                .map(|n| json!([arredondar(n.inicio), arredondar(n.dur), n.midi]))
                .collect();
            json!({ "nome": v.nome, "notas": notas })
        })
        .collect()
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

const AJUDA: &str = "Uso: mscx2json [--nomes-originais] [--idioma pt-BR] [--correcoes correcoes.json] --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json\n\
--idioma declara o idioma do conteúdo (título e letra) no hinário gerado.\n\
--correcoes aplica as correções explícitas da letra (formato em docs/correcoes-da-letra.md); cada uma vira um aviso.\n\
--nomes-originais mantém \"Parte I..IV\" em vez de Soprano/Contralto/Tenor/Baixo.\n\
Os arquivos devem se chamar hino-<número>.mscx; os demais são ignorados com um aviso.";

fn numero_do_arquivo(p: &Path) -> Option<u32> {
    p.file_stem()?.to_str()?.strip_prefix("hino-")?.parse().ok()
}

fn executar(args: Vec<String>) -> Result<(), String> {
    let (mut id, mut nome, mut entradas) = (None, None, vec![]);
    let mut renomear = true;
    let mut idioma: Option<String> = None;
    let mut arquivo_correcoes: Option<PathBuf> = None;
    let mut it = args.into_iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--id" => id = it.next(),
            "--nome" => nome = it.next(),
            "--nomes-originais" => renomear = false,
            "--idioma" => idioma = it.next(),
            "--correcoes" => {
                let c = it
                    .next()
                    .ok_or("--correcoes precisa do caminho do arquivo")?;
                arquivo_correcoes = Some(PathBuf::from(c));
            }
            "-h" | "--ajuda" => {
                println!("{AJUDA}");
                return Ok(());
            }
            _ => entradas.push(PathBuf::from(a)),
        }
    }
    let (id, nome) = (id.ok_or(AJUDA)?, nome.ok_or(AJUDA)?);
    let correcoes: Correcoes = match &arquivo_correcoes {
        Some(c) => {
            let texto = std::fs::read_to_string(c).map_err(|e| format!("{}: {e}", c.display()))?;
            correcoes::ler(&texto).map_err(|e| format!("{}: {e}", c.display()))?
        }
        None => Correcoes::new(),
    };

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
            eprintln!(
                "aviso: {} ignorado (nome fora do padrão hino-<número>.mscx)",
                arq.display()
            );
            continue;
        };
        let xml = std::fs::read_to_string(&arq).map_err(|e| format!("{}: {e}", arq.display()))?;
        let ajustes = correcoes.get(&n).map(Vec::as_slice).unwrap_or(&[]);
        let mut h =
            converter_com(&xml, n, ajustes).map_err(|e| format!("{}: {e}", arq.display()))?;
        if renomear {
            nomes_satb(&mut h);
        }
        for a in &h.avisos {
            eprintln!("aviso: {}: {a}", arq.display());
        }
        hinos.push(h);
    }
    hinos.sort_by_key(|h| h.numero);
    for n in correcoes
        .keys()
        .filter(|n| !hinos.iter().any(|h| h.numero == **n))
    {
        eprintln!(
            "aviso: há correções para o hino {n}, mas não há arquivo hino-{n}.mscx nesta conversão"
        );
    }
    if let Some(p) = hinos.windows(2).find(|p| p[0].numero == p[1].numero) {
        return Err(format!("número de hino repetido: {}", p[0].numero));
    }

    let saida = json!({
        "versao": 1,
        "hinario": cabecalho(&id, &nome, idioma.as_deref()),
        "hinos": hinos.iter().map(para_json).collect::<Vec<_>>(),
    });
    println!(
        "{}",
        serde_json::to_string(&saida).map_err(|e| e.to_string())?
    );
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
        format!(
            "<Chord><durationType>{tipo}</durationType><Note><pitch>{pitch}</pitch></Note></Chord>"
        )
    }
    fn pauta(id: u32, compassos: &str) -> String {
        format!(r#"<Staff id="{id}">{compassos}</Staff>"#)
    }
    fn compasso(corpo: &str) -> String {
        format!("<Measure><voice>{corpo}</voice></Measure>")
    }
    const C44: &str = "<TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>";

    fn notas(h: &Hino, voz: usize) -> Vec<(f64, f64, u8)> {
        h.vozes[voz]
            .notas
            .iter()
            .map(|n| (n.inicio, n.dur, n.midi))
            .collect()
    }

    #[test]
    fn notas_simples_titulo_e_andamento() {
        let corpo = format!(
            "{C44}<Tempo><tempo>1.5</tempo></Tempo>{}{}{}{}",
            acorde("quarter", 72),
            acorde("quarter", 74),
            acorde("quarter", 76),
            acorde("quarter", 77)
        );
        let h = converter(&doc(&parte(1, "Soprano"), &pauta(1, &compasso(&corpo))), 7).unwrap();
        assert_eq!(
            (h.numero, h.titulo.as_str(), h.andamento),
            (7, "Título fictício", Some(90))
        );
        assert_eq!(h.vozes[0].nome, "Soprano");
        assert_eq!(
            notas(&h, 0),
            vec![
                (0.0, 1.0, 72),
                (1.0, 1.0, 74),
                (2.0, 1.0, 76),
                (3.0, 1.0, 77)
            ]
        );
    }

    #[test]
    fn pontuada_pausa_e_segundo_compasso() {
        let c1 = format!(
            "{C44}<Chord><durationType>quarter</durationType><dots>1</dots><Note><pitch>60</pitch></Note></Chord>{}<Rest><durationType>half</durationType></Rest>",
            acorde("eighth", 62)
        );
        let c2 = acorde("whole", 64);
        let h = converter(
            &doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))),
            1,
        )
        .unwrap();
        assert_eq!(
            notas(&h, 0),
            vec![(0.0, 1.5, 60), (1.5, 0.5, 62), (4.0, 4.0, 64)]
        );
    }

    #[test]
    fn pausa_de_compasso_inteiro_usa_o_tamanho_do_compasso() {
        let c1 = format!(
            "{C44}<Rest><durationType>measure</durationType><duration>4/4</duration></Rest>"
        );
        let c2 = acorde("quarter", 60);
        let h = converter(
            &doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))),
            1,
        )
        .unwrap();
        assert_eq!(notas(&h, 0), vec![(4.0, 1.0, 60)]);
    }

    #[test]
    fn anacruse_com_len() {
        let c1 = format!(
            r#"<Measure len="1/4"><voice>{C44}{}</voice></Measure>"#,
            acorde("quarter", 60)
        );
        let c2 = compasso(&acorde("whole", 62));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &(c1 + &c2))), 1).unwrap();
        assert_eq!(notas(&h, 0), vec![(0.0, 1.0, 60), (1.0, 4.0, 62)]);
    }

    #[test]
    fn tercina_estilo_marcador_e_aninhado() {
        let tupla = "<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes></Tuplet>";
        let tres = format!(
            "{}{}{}",
            acorde("eighth", 60),
            acorde("eighth", 62),
            acorde("eighth", 64)
        );
        let plano = format!("{C44}{tupla}{tres}<endTuplet/>{}", acorde("quarter", 65));
        let aninhado = format!(
            "{C44}<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes>{tres}</Tuplet>{}",
            acorde("quarter", 65)
        );
        for corpo in [plano, aninhado] {
            let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&corpo))), 1).unwrap();
            let n = notas(&h, 0);
            assert!((n[1].0 - 1.0 / 3.0).abs() < 1e-3 && (n[1].1 - 1.0 / 3.0).abs() < 1e-3);
            assert!(
                (n[3].0 - 1.0).abs() < 1e-3,
                "a nota depois da tercina começa em 1: {n:?}"
            );
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
        let corpo = format!(
            "{C44}<Tempo><tempo>1</tempo></Tempo>{}{}",
            acorde("half", 60),
            acorde("half", 62)
        );
        let extra = format!("<voice>{}</voice>", acorde("whole", 55));
        let h = converter(
            &doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, &extra))),
            1,
        )
        .unwrap();
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
            acorde("half", 60),
            acorde("half", 62)
        );
        let h = converter(
            &doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, ""))),
            1,
        )
        .unwrap();
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
        let h = converter(
            &doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))),
            1,
        )
        .unwrap();
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(nomes, vec!["Parte I", "Parte II"]);
        assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 67)]); // mais aguda
        assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 60)]); // mais grave
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("notas do meio omitidas")),
            "{:?}",
            h.avisos
        );
    }

    #[test]
    fn letra_por_estrofe_com_silabas_e_quebra_na_respiracao() {
        let ac = |sil: &[(&str, Option<u32>, &str)], pitch: u8| {
            let ls: String = sil
                .iter()
                .map(|(sy, no, t)| {
                    let no = no.map(|n| format!("<no>{n}</no>")).unwrap_or_default();
                    let sy = if sy.is_empty() {
                        String::new()
                    } else {
                        format!("<syllabic>{sy}</syllabic>")
                    };
                    format!("<Lyrics>{no}{sy}<text>{t}</text></Lyrics>")
                })
                .collect();
            format!(
                "<Chord><durationType>quarter</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord>"
            )
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
            format!(
                "<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>",
                l(t)
            )
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

    // --- Quebra de linha por VERSO (a partitura respira também no meio do verso). Tudo com texto fictício. ---

    fn silaba_de(t: f64, texto: &str, continua: bool) -> Silaba {
        Silaba {
            t,
            voz: 0,
            verso: 0,
            continua,
            quebra_antes: false,
            texto: texto.to_string(),
        }
    }

    /// Sílabas de uma estrofe, de 1 em 1 batida, e as respirações logo antes das palavras de índice `antes` (em batidas - 0,5).
    fn estrofe_com_respiracoes(palavras: &[&str], antes: &[usize]) -> (Vec<Silaba>, Vec<f64>) {
        let silabas = palavras
            .iter()
            .enumerate()
            .map(|(i, w)| silaba_de(i as f64, w, false))
            .collect();
        (silabas, antes.iter().map(|&i| i as f64 - 0.5).collect())
    }

    #[test]
    fn respiracao_no_meio_do_verso_nao_quebra_a_linha() {
        // "Alfa beta | gama delta;" é um verso só; "Épsilon zeta | eta teta." é outro. As respirações antes de "gama" e de "eta"
        // seguem minúscula (continuam o verso); a antes de "Épsilon" e a antes de "Iota" seguem maiúscula (verso novo).
        let (silabas, respiracoes) = estrofe_com_respiracoes(
            &[
                "Alfa", "beta", "gama", "delta;", "Épsilon", "zeta", "eta", "teta.", "Iota", "kapa",
            ],
            &[2, 4, 6, 8],
        );
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(
            letra,
            vec![
                "1. Alfa beta gama delta;",
                "Épsilon zeta eta teta.",
                "Iota kapa"
            ]
        );
    }

    #[test]
    fn nome_reverencial_sem_pontuacao_antes_continua_o_verso() {
        // "Alfa beta | Jesus gama;": "Jesus" é maiúsculo por reverência, e o trecho anterior não tem pontuação.
        let (silabas, respiracoes) = estrofe_com_respiracoes(
            &[
                "Alfa", "beta;", "Gama", "delta", "Jesus", "eta;", "Teta", "iota.",
            ],
            &[2, 4, 6],
        );
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(
            letra,
            vec!["1. Alfa beta;", "Gama delta Jesus eta;", "Teta iota."]
        );
    }

    #[test]
    fn nome_reverencial_depois_de_pontuacao_comeca_verso() {
        // "Alfa beta, | Rei gama,": o trecho anterior termina em vírgula, então "Rei" abre um verso novo.
        let (silabas, respiracoes) =
            estrofe_com_respiracoes(&["Alfa", "beta,", "Rei", "gama,", "Delta", "eta."], &[2, 4]);
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(letra, vec!["1. Alfa beta,", "Rei gama,", "Delta eta."]);
    }

    #[test]
    fn palavra_reverencial_em_varias_silabas_tambem_vale() {
        // "Je" + "sus": a palavra inteira é que decide, não a primeira sílaba.
        let silabas = vec![
            silaba_de(0.0, "Alfa", false),
            silaba_de(1.0, "beta", false),
            silaba_de(2.0, "Gama", false),
            silaba_de(3.0, "delta", false),
            silaba_de(4.0, "Je", true),
            silaba_de(5.0, "sus", false),
            silaba_de(6.0, "eta;", false),
            silaba_de(7.0, "Teta", false),
            silaba_de(8.0, "iota.", false),
        ];
        let (letra, _) = montar_letra(silabas, vec![1.5, 3.5, 6.5]);
        assert_eq!(
            letra,
            vec!["1. Alfa beta", "Gama delta Jesus eta;", "Teta iota."]
        );
    }

    #[test]
    fn sem_maiuscula_depois_das_respiracoes_vale_a_quebra_em_toda_respiracao() {
        // O autor escreveu tudo em minúscula: não há pista, e fica o comportamento de sempre.
        let (silabas, respiracoes) =
            estrofe_com_respiracoes(&["alfa", "beta", "gama", "delta", "eta", "teta"], &[2, 4]);
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(letra, vec!["1. alfa beta", "gama delta", "eta teta"]);
    }

    #[test]
    fn nome_reverencial_nao_conta_como_pista_para_ligar_a_regra() {
        // Estrofe em minúsculo, com duas respirações antes de nomes reverenciais (sem pontuação antes): não há pista de verso,
        // e vale a quebra a cada respiração, e não uma linha só.
        let (silabas, respiracoes) = estrofe_com_respiracoes(
            &[
                "alfa", "beta", "Jesus", "gama", "delta", "Senhor", "eta", "teta",
            ],
            &[2, 5],
        );
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(
            letra,
            vec!["1. alfa beta", "Jesus gama delta", "Senhor eta teta"]
        );
    }

    #[test]
    fn outros_nomes_reverenciais_tambem_continuam_o_verso() {
        let (silabas, respiracoes) = estrofe_com_respiracoes(
            &[
                "Alfa", "beta;", "Gama", "delta", "Filho", "eta;", "Teta", "iota", "Jeová", "kapa.",
            ],
            &[2, 4, 6, 8],
        );
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(
            letra,
            vec![
                "1. Alfa beta;",
                "Gama delta Filho eta;",
                "Teta iota Jeová kapa."
            ]
        );
    }

    // --- Coro do final: vai para a última estrofe. Texto fictício. ---

    fn silaba_em(t: f64, verso: u32, texto: &str) -> Silaba {
        Silaba {
            t,
            voz: 0,
            verso,
            continua: false,
            quebra_antes: false,
            texto: texto.to_string(),
        }
    }

    /// Três estrofes de duas sílabas (tempos 0 a 5, com a estrofe 3 entre 4 e 5) e o coro depois (tempos 10 e 11).
    fn estrofes_com_coro(verso_do_coro: u32) -> Vec<Silaba> {
        vec![
            silaba_em(0.0, 0, "alfa"),
            silaba_em(1.0, 0, "beta"),
            silaba_em(2.0, 1, "gama"),
            silaba_em(3.0, 1, "delta"),
            silaba_em(4.0, 2, "eta"),
            silaba_em(5.0, 2, "teta"),
            silaba_em(10.0, verso_do_coro, "coro"),
            silaba_em(11.0, verso_do_coro, "final"),
        ]
    }

    #[test]
    fn coro_escrito_sob_a_estrofe_1_vai_para_a_ultima() {
        let mut s = estrofes_com_coro(0);
        coro_para_a_ultima_estrofe(&mut s, 10.0);
        let (letra, _) = montar_letra(s, vec![9.5]);
        assert_eq!(
            letra,
            vec![
                "1. alfa beta",
                "",
                "2. gama delta",
                "",
                "3. eta teta",
                "coro final"
            ]
        );
    }

    #[test]
    fn coro_que_ja_esta_na_ultima_estrofe_fica_como_esta() {
        let mut s = estrofes_com_coro(2);
        coro_para_a_ultima_estrofe(&mut s, 10.0);
        assert!(s.iter().filter(|x| x.t >= 10.0).all(|x| x.verso == 2));
        assert!(
            s.iter()
                .filter(|x| x.t < 10.0)
                .map(|x| x.verso)
                .eq([0, 0, 1, 1, 2, 2])
        );
    }

    #[test]
    fn coro_sob_mais_de_uma_estrofe_nao_e_mexido() {
        // Texto do final sob as estrofes 1 e 2: não há como saber a qual pertence cada trecho.
        let mut s = estrofes_com_coro(0);
        s[7].verso = 1;
        coro_para_a_ultima_estrofe(&mut s, 10.0);
        assert_eq!((s[6].verso, s[7].verso), (0, 1));
    }

    #[test]
    fn refrao_com_as_primeiras_silabas_na_estrofe_errada_volta_para_a_estrofe_do_resto() {
        // estrofes 0, 1 e 2 juntas nos tempos 0 a 2; depois o refrão (3 a 6): as duas primeiras sílabas marcadas como estrofe 1.
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(0.0, 2, "c"),
            silaba_em(2.0, 0, "d"),
            silaba_em(2.0, 1, "e"),
            silaba_em(2.0, 2, "f"),
            silaba_em(3.0, 1, "A"),
            silaba_em(4.0, 1, "Ro"),
            silaba_em(5.0, 0, "cha"),
            silaba_em(6.0, 0, "eternal"),
        ];
        assert_eq!(refrao_com_estrofe_trocada(&mut s), 2);
        let versos: Vec<u32> = s.iter().filter(|x| x.t >= 3.0).map(|x| x.verso).collect();
        assert_eq!(versos, vec![0, 0, 0, 0]);
        // as estrofes em si não mudam
        assert_eq!(s.iter().filter(|x| x.t < 3.0 && x.verso == 1).count(), 2);
    }

    #[test]
    fn silaba_sem_letra_solta_no_refrao_nao_conta_como_estrofe_junta() {
        // o "'" da estrofe 0 cai junto com "deira," da estrofe 1 depois das estrofes (hino 399): não prende o corte
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(3.0, 1, "És"),
            silaba_em(4.0, 1, "deira,"),
            silaba_em(4.0, 0, "'"),
            silaba_em(5.0, 0, "ó"),
            silaba_em(6.0, 0, "Rei"),
        ];
        assert_eq!(refrao_com_estrofe_trocada(&mut s), 2);
        assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == 0));
    }

    #[test]
    fn sem_resto_depois_das_estrofes_nada_muda() {
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(1.0, 0, "c"),
            silaba_em(1.0, 1, "d"),
        ];
        assert_eq!(refrao_com_estrofe_trocada(&mut s), 0);
    }

    #[test]
    fn resto_ja_numa_estrofe_so_nao_muda() {
        // a última estrofe é mais comprida: depois das juntas só existe a estrofe 1, então não há o que corrigir
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(2.0, 1, "c"),
            silaba_em(3.0, 1, "d"),
        ];
        assert_eq!(refrao_com_estrofe_trocada(&mut s), 0);
        assert!(s.iter().filter(|x| x.t >= 2.0).all(|x| x.verso == 1));
    }

    #[test]
    fn empate_no_resto_fica_com_a_menor_estrofe() {
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(3.0, 1, "x"),
            silaba_em(4.0, 0, "y"),
        ];
        assert_eq!(refrao_com_estrofe_trocada(&mut s), 1);
        assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == 0));
    }

    #[test]
    fn o_que_sobra_depois_das_estrofes_vira_o_coro() {
        // estrofes 0 e 1 juntas nos tempos 0 e 1; depois, 6 sílabas só da estrofe 0: o coro
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(1.0, 0, "c"),
            silaba_em(1.0, 1, "d"),
        ];
        for (i, x) in ["A", "Ro", "cha", "ce", "les", "tial"].iter().enumerate() {
            s.push(silaba_em(3.0 + i as f64, 0, x));
        }
        assert_eq!(separar_o_coro(&mut s), 6);
        assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == CORO));
        assert!(s.iter().filter(|x| x.t < 3.0).all(|x| x.verso != CORO));
        let (letra, marcas) = montar_letra(s, vec![]);
        assert_eq!(
            letra,
            vec!["1. a c", "", "Coro. A Ro cha ce les tial", "", "2. b d"]
        );
        assert!(marcas.iter().any(|m| m.verso == CORO));
    }

    fn base_de_duas_estrofes() -> Vec<Silaba> {
        vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(1.0, 0, "c"),
            silaba_em(1.0, 1, "d"),
        ]
    }

    #[test]
    fn final_mais_longo_da_ultima_estrofe_nao_e_coro() {
        // o resto está na estrofe de maior número (a 1): é só a última estrofe, mais comprida
        let mut s = base_de_duas_estrofes();
        for i in 0..8 {
            s.push(silaba_em(3.0 + i as f64, 1, "xis"));
        }
        assert_eq!(separar_o_coro(&mut s), 0);
        assert!(s.iter().all(|x| x.verso != CORO));
    }

    #[test]
    fn silaba_repetida_em_duas_vozes_conta_uma_vez() {
        // 3 sílabas escritas nas duas vozes = 3, abaixo do mínimo
        let mut s = base_de_duas_estrofes();
        for i in 0..3 {
            let mut a = silaba_em(3.0 + i as f64, 0, "fim");
            a.voz = 0;
            let mut b = silaba_em(3.0 + i as f64, 0, "fim");
            b.voz = 1;
            s.push(a);
            s.push(b);
        }
        assert_eq!(separar_o_coro(&mut s), 0);
    }

    #[test]
    fn corte_no_meio_de_uma_palavra_deixa_o_pedaco_na_estrofe() {
        // "gló-ri-a": "gló" canta junto com a estrofe 1 (é o último instante com estrofes juntas); "ri" e "a" vêm depois
        let mut glo = silaba_em(1.0, 0, "gló");
        glo.continua = true;
        let mut ri = silaba_em(2.0, 0, "ri");
        ri.continua = true;
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            glo,
            silaba_em(1.0, 1, "d"),
            ri,
        ];
        s.push(silaba_em(3.0, 0, "a"));
        for (i, x) in ["Aleluia", "ao", "Senhor", "dos", "céus", "amém"]
            .iter()
            .enumerate()
        {
            s.push(silaba_em(5.0 + i as f64, 0, x));
        }
        assert_eq!(separar_o_coro(&mut s), 6);
        assert!(s.iter().filter(|x| x.t <= 3.0).all(|x| x.verso != CORO));
        assert!(s.iter().filter(|x| x.t >= 5.0).all(|x| x.verso == CORO));
    }

    #[test]
    fn resto_curto_depois_das_estrofes_nao_e_coro() {
        // fim de estrofe escrito uma vez só (menos de 6 sílabas): fica na estrofe
        let mut s = vec![
            silaba_em(0.0, 0, "a"),
            silaba_em(0.0, 1, "b"),
            silaba_em(3.0, 0, "fim"),
            silaba_em(4.0, 0, "da"),
        ];
        assert_eq!(separar_o_coro(&mut s), 0);
        assert!(s.iter().all(|x| x.verso != CORO));
    }

    #[test]
    fn hino_de_uma_estrofe_so_nao_muda() {
        let mut s = vec![silaba_em(0.0, 0, "alfa"), silaba_em(10.0, 0, "coro")];
        coro_para_a_ultima_estrofe(&mut s, 10.0);
        assert!(s.iter().all(|x| x.verso == 0));
    }

    #[test]
    fn no_hino_com_final_o_coro_escrito_sob_a_estrofe_1_sai_na_ultima() {
        // Mesma estrutura do hino com final: o texto do trecho final (compassos 5 e 6) está sob a estrofe 1 (<no>0),
        // e a 2ª casa traz só a última sílaba da estrofe 2.
        let comp = |extra: &str, pitch: u8, letras: &[(u32, &str)]| {
            let ls: String = letras
                .iter()
                .map(|(no, t)| format!("<Lyrics><no>{no}</no><text>{t}</text></Lyrics>"))
                .collect();
            format!(
                "<Measure>{extra}<voice>{C44}<Chord><durationType>whole</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord></voice></Measure>"
            )
        };
        let medidas = [
            comp("<startRepeat/>", 60, &[(0, "a"), (1, "b")]),
            comp("", 62, &[(0, "c"), (1, "d")]),
            comp(
                r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
                64,
                &[(0, "e"), (1, "f")],
            ),
            comp(
                r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
                65,
                &[(1, "g")],
            ),
            comp(r#"<endSpanner id="2"/>"#, 67, &[(0, "coro")]),
            comp("", 69, &[(0, "final")]),
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        assert_eq!(h.letra, vec!["1. a c e", "", "2. b d f g coro final"]);
    }

    #[test]
    fn correcoes_do_arquivo_valem_na_conversao_e_viram_avisos() {
        // "al" + "fa" sem marcador de continuação, "bta" digitado errado, e dois versos colados (sem respiração) em "Gama".
        let c = format!(
            "{C44}{}{}{}{}{}",
            acorde_letra(60, &sil("", "al")),
            acorde_letra(62, &sil("", "fa")),
            acorde_letra(64, &sil("", "bta.")),
            acorde_letra(65, &sil("", "Gama")),
            acorde_letra(67, &sil("", "delta")),
        );
        let xml = doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, "")));
        let texto = r#"{ "hinos": { "1": [
            { "estrofe": 1, "juntar": "al fa" },
            { "estrofe": 1, "trocar": "bta.", "por": "beta." },
            { "estrofe": 1, "quebrar_antes": "Gama delta" } ] } }"#;
        let c = correcoes::ler(texto).unwrap();
        let h = converter_com(&xml, 1, &c[&1]).unwrap();
        assert_eq!(h.letra, vec!["1. alfa beta.", "Gama delta"]);
        let aplicadas = h
            .avisos
            .iter()
            .filter(|a| a.contains("correção aplicada"))
            .count();
        assert_eq!(aplicadas, 3, "{:?}", h.avisos);
        // Sem o arquivo, o texto fica como o autor escreveu.
        let sem = converter(&xml, 1).unwrap();
        assert_eq!(sem.letra, vec!["1. al fa bta. Gama delta"]);
    }

    #[test]
    fn correcoes_de_um_hino_sem_letra_avisam_em_vez_de_sumir() {
        // Partitura sem <Lyrics>: nenhuma correção pode ser tentada, e o responsável tem de saber.
        let c = correcoes::ler(r#"{ "hinos": { "1": [ { "estrofe": 1, "juntar": "al fa" } ] } }"#)
            .unwrap();
        let h = converter_com(&hino_com_final(), 1, &c[&1]).unwrap();
        assert!(h.letra.is_empty());
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("NÃO aplicada") && a.contains("não tem letra")),
            "{:?}",
            h.avisos
        );
        // Sem correções listadas, nada a avisar.
        let sem = converter_com(&hino_com_final(), 1, &[]).unwrap();
        assert!(
            !sem.avisos.iter().any(|a| a.contains("correç")),
            "{:?}",
            sem.avisos
        );
    }

    #[test]
    fn correcoes_sem_o_caminho_do_arquivo_e_erro() {
        let args = ["--id", "x", "--nome", "y", "--correcoes"]
            .map(String::from)
            .to_vec();
        let e = executar(args).unwrap_err();
        assert!(e.contains("--correcoes precisa do caminho"), "{e}");
    }

    #[test]
    fn uma_unica_maiuscula_nao_basta_para_ligar_a_regra() {
        let (silabas, respiracoes) =
            estrofe_com_respiracoes(&["alfa", "beta", "Gama", "delta", "eta", "teta"], &[2, 4]);
        let (letra, _) = montar_letra(silabas, respiracoes);
        assert_eq!(letra, vec!["1. alfa beta", "Gama delta", "eta teta"]);
    }

    #[test]
    fn as_marcas_do_karaoke_continuam_batendo_com_o_texto_da_linha() {
        // A sincronia aponta para posições dentro da linha pronta: se uma respiração deixa de quebrar, as posições seguem certas.
        let (silabas, respiracoes) = estrofe_com_respiracoes(
            &[
                "Alfa", "beta", "gama", "delta;", "Épsilon", "zeta", "eta", "teta.", "Iota", "kapa",
            ],
            &[2, 4, 6, 8],
        );
        let textos: Vec<String> = silabas.iter().map(|x| x.texto.clone()).collect();
        let (letra, marcas) = montar_letra(silabas, respiracoes);
        let linhas: Vec<String> = letra
            .iter()
            .enumerate()
            .map(|(i, l)| {
                if i == 0 {
                    l.trim_start_matches("1. ").to_string()
                } else {
                    l.clone()
                }
            })
            .collect();
        assert_eq!(marcas.len(), textos.len());
        for (m, esperado) in marcas.iter().zip(&textos) {
            let utf16: Vec<u16> = linhas[m.linha].encode_utf16().collect();
            assert_eq!(
                &String::from_utf16(&utf16[m.de..m.ate]).unwrap(),
                esperado,
                "marca {m:?}"
            );
        }
    }

    #[test]
    fn pronome_colado_ao_verbo_acentuado_ganha_hifen() {
        // "cantá" + "lo": o autor esqueceu o hífen; "I" maiúsculo no lugar de "l" também é consertado.
        let silabas = vec![
            silaba_de(0.0, "can", true),
            silaba_de(1.0, "tá", true),
            silaba_de(2.0, "lo,", false),
            silaba_de(3.0, "dê", true),
            silaba_de(4.0, "Ihe", false),
            silaba_de(5.0, "ba", true),
            silaba_de(6.0, "la.", false),
        ];
        let (letra, _) = montar_letra(silabas, vec![]);
        // "ba" + "la" não é pronome: "ba" não termina em vogal acentuada.
        assert_eq!(letra, vec!["1. cantá-lo, dê-lhe bala."]);
    }

    #[test]
    fn palavra_com_la_ou_lo_final_sem_acento_antes_nao_ganha_hifen() {
        let silabas = vec![
            silaba_de(0.0, "es", true),
            silaba_de(1.0, "tre", true),
            silaba_de(2.0, "la", false),
            silaba_de(3.0, "só", false),
            silaba_de(4.0, "lo", false),
        ];
        let (letra, _) = montar_letra(silabas, vec![]);
        // "só" e "lo" são duas palavras (a primeira não continua): sem hífen.
        assert_eq!(letra, vec!["1. estrela só lo"]);
    }

    #[test]
    fn til_literal_vira_espaco_e_o_que_e_ambiguo_fica_como_esta() {
        // "~" literal é a elisão: vira espaço. Já "mãc" poderia ser "mão" ou "mãe" e "Iba" no meio da palavra, "lba" ou "iba":
        // sem uma só leitura possível, o conversor não adivinha (isso é com o arquivo de correções).
        let silabas = vec![
            silaba_de(0.0, "a,~al", false),
            silaba_de(1.0, "mãc", false),
            silaba_de(2.0, "ca", true),
            silaba_de(3.0, "Iba", false),
        ];
        let (letra, _) = montar_letra(silabas, vec![]);
        assert_eq!(letra, vec!["1. a, al mãc caIba"]);
    }

    #[test]
    fn as_marcas_seguem_o_texto_corrigido() {
        let silabas = vec![
            silaba_de(0.0, "can", true),
            silaba_de(1.0, "tá", true),
            silaba_de(2.0, "lo", false),
        ];
        let (letra, marcas) = montar_letra(silabas, vec![]);
        assert_eq!(letra, vec!["1. cantá-lo"]);
        let u: Vec<u16> = "cantá-lo".encode_utf16().collect();
        assert_eq!(
            marcas
                .last()
                .map(|m| String::from_utf16(&u[m.de..m.ate]).unwrap()),
            Some("-lo".to_string())
        );
    }

    #[test]
    fn letra_duplicada_em_duas_camadas_vale_uma_vez() {
        let l = |t: &str| format!("<Lyrics><text>{t}</text></Lyrics>");
        let ch = |t: &str, p: u8, extra: &str| {
            format!(
                "<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>",
                l(t)
            )
        };
        let c = format!(
            "{C44}{}<tick>0</tick>{}",
            ch("la", 60, ""),
            ch("la", 55, "<track>1</track>")
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. la"]);
    }

    /// Compasso de uma semibreve com uma sílaba (estrofe 1) na nota, para os testes da sincronia.
    fn comp_com_silaba(extra: &str, pitch: u8, silaba: &str) -> String {
        format!(
            "<Measure>{extra}<voice>{C44}<Chord><durationType>whole</durationType><Lyrics><text>{silaba}</text></Lyrics>\
             <Note><pitch>{pitch}</pitch></Note></Chord></voice></Measure>"
        )
    }

    #[test]
    fn sincronia_marca_a_posicao_na_linha_e_o_instante_de_cada_silaba() {
        let ac = |sil: &[(&str, Option<u32>, &str)], pitch: u8| {
            let ls: String = sil
                .iter()
                .map(|(sy, no, t)| {
                    let no = no.map(|n| format!("<no>{n}</no>")).unwrap_or_default();
                    let sy = if sy.is_empty() {
                        String::new()
                    } else {
                        format!("<syllabic>{sy}</syllabic>")
                    };
                    format!("<Lyrics>{no}{sy}<text>{t}</text></Lyrics>")
                })
                .collect();
            format!(
                "<Chord><durationType>quarter</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord>"
            )
        };
        let c = format!(
            "{C44}{}{}<Breath/>{}",
            ac(&[("begin", None, "ba"), ("", Some(1), "la")], 60),
            ac(&[("end", None, "la"), ("", Some(1), "lá")], 62),
            ac(&[("", None, "um"), ("", Some(1), "dois")], 64),
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. bala", "um", "", "2. la lá", "dois"]);
        let s = h.sincronia.expect("deveria ter sincronia");
        assert!(s.passada_final.is_none());
        // Estrofe 1: "bala" (ba=0..2 em t0, la=2..4 em t1) e "um" na linha seguinte (t2).
        assert_eq!(s.normal[0].estrofe, 1);
        assert_eq!(
            s.normal[0].linhas,
            vec![vec![(0.0, 0, 2), (1.0, 2, 4)], vec![(2.0, 0, 2)]]
        );
        // Estrofe 2: "la lá" (a posição do "lá" conta o espaço: 3..5) e "dois".
        assert_eq!(s.normal[1].estrofe, 2);
        assert_eq!(
            s.normal[1].linhas,
            vec![vec![(0.0, 0, 2), (1.0, 3, 5)], vec![(2.0, 0, 4)]]
        );
    }

    #[test]
    fn sincronia_da_passada_do_final_pula_a_1a_casa_e_fica_sem_buracos() {
        // Mesma estrutura do hino com final (6 compassos): normal = 1 a 3; final = 1, 2, 4, 5 e 6.
        let medidas = [
            comp_com_silaba("<startRepeat/>", 60, "a"),
            comp_com_silaba("", 62, "b"),
            comp_com_silaba(
                r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
                64,
                "c",
            ),
            comp_com_silaba(
                r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
                65,
                "d",
            ),
            comp_com_silaba(r#"<endSpanner id="2"/>"#, 67, "e"),
            comp_com_silaba("", 69, "f"),
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        assert_eq!(h.letra, vec!["1. a b c d e f"]);
        let s = h.sincronia.expect("deveria ter sincronia");
        // Passada normal: só a, b, c (compassos 1 a 3), nos tempos da partitura.
        assert_eq!(
            s.normal[0].linhas,
            vec![vec![(0.0, 0, 1), (4.0, 2, 3), (8.0, 4, 5)]]
        );
        // Passada do final: "c" (1ª casa) não toca; d, e, f entram no lugar dele, colados, na régua das notas do final.
        let f = s.passada_final.expect("deveria ter sincronia do final");
        assert_eq!(
            f[0].linhas,
            vec![vec![
                (0.0, 0, 1),
                (4.0, 2, 3),
                (8.0, 6, 7),
                (12.0, 8, 9),
                (16.0, 10, 11)
            ]]
        );
        // Confere com as notas do final: o "d" cai na nota de 8 batidas (pitch 65), como a sílaba.
        let nf = h.passada_final.as_ref().unwrap();
        assert!(nf[0].notas.iter().any(|n| n.inicio == 8.0 && n.midi == 65));
    }

    #[test]
    fn sincronia_vai_para_o_json_e_some_sem_letra() {
        let medidas = [comp_com_silaba("", 60, "la"), comp_com_silaba("", 62, "lá")].concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        let j = para_json(&h);
        assert_eq!(j["sincronia"]["normal"][0]["estrofe"], 1);
        assert_eq!(
            j["sincronia"]["normal"][0]["linhas"][0],
            json!([[0.0, 0, 2], [4.0, 3, 5]])
        );
        assert!(
            j["sincronia"].get("final").is_none(),
            "sem final, sem sincronia do final"
        );

        let c = format!("{C44}{}", acorde("whole", 60));
        let sem = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        assert!(sem.sincronia.is_none() && para_json(&sem).get("sincronia").is_none());
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
            passada_final: None,
            introducao: None,
            andamento: None,
            armadura: 0,
            modo: "maior",
            vozes: ["Parte I", "Parte II", "Parte III", "Parte IV", "Outra"]
                .iter()
                .map(|n| Voz {
                    nome: n.to_string(),
                    notas: vec![],
                })
                .collect(),
            letra: vec![],
            sincronia: None,
            compassos: None,
            avisos: vec![],
        };
        nomes_satb(&mut h);
        let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(
            nomes,
            vec!["Soprano", "Contralto", "Tenor", "Baixo", "Outra"]
        );
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

        let m = format!(
            "<VBox>{}{}</VBox>",
            texto_moldura("Lyricist", "A"),
            texto_moldura("Composer", "A")
        );
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.autoria.as_deref(), Some("A")); // mesma pessoa nos dois papéis
    }

    #[test]
    fn titulo_com_formatacao_e_espacos_repetidos_sai_limpo() {
        let m = format!(
            "<VBox>{}</VBox>",
            texto_moldura("Title", "Canta, <i>ó</i>   Mundo\n  Hoje")
        );
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.titulo, "Canta, ó Mundo Hoje");
    }

    #[test]
    fn cabecalho_so_leva_idioma_quando_informado() {
        assert_eq!(
            cabecalho("a", "A", Some("pt-BR")),
            json!({"id":"a","nome":"A","idioma":"pt-BR"})
        );
        assert_eq!(cabecalho("a", "A", None), json!({"id":"a","nome":"A"}));
        assert_eq!(
            cabecalho("a", "A", Some("  ")),
            json!({"id":"a","nome":"A"})
        );
    }

    /// Compasso de uma semibreve em 4/4 (4 batidas) com marcas extras de repetição/volta.
    fn comp_marcado(extra: &str, pitch: u8) -> String {
        format!(
            "<Measure>{extra}<voice>{C44}{}</voice></Measure>",
            acorde("whole", pitch)
        )
    }

    /// Mesma estrutura do hino 457: repetição do compasso 1, fim de repetição + 1ª casa no 3, 2ª casa no 4
    /// e trecho final (5 e 6).
    fn hino_com_final() -> String {
        let medidas = [
            comp_marcado("<startRepeat/>", 60),
            comp_marcado("", 62),
            comp_marcado(
                r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
                64,
            ),
            comp_marcado(
                r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
                65,
            ),
            comp_marcado(r#"<endSpanner id="2"/>"#, 67),
            comp_marcado("", 69),
        ]
        .concat();
        doc(&parte(1, "S"), &pauta(1, &medidas))
    }

    fn notas_de(vozes: &[Voz], i: usize) -> Vec<(f64, f64, u8)> {
        vozes[i]
            .notas
            .iter()
            .map(|n| (n.inicio, n.dur, n.midi))
            .collect()
    }

    /// Dois compassos de 4/4; no 2º, uma mínima, o texto de pauta "*" e outra mínima (o "*" é escrito sobre a 2ª mínima, a última nota da introdução).
    fn hino_com_asterisco() -> String {
        let marca = "<StaffText><text>*</text></StaffText>";
        let m1 = comp_marcado("", 60);
        let m2 = format!(
            "<Measure><voice>{C44}{}{marca}{}</voice></Measure>",
            acorde("half", 62),
            acorde("half", 64)
        );
        doc(&parte(1, "S"), &pauta(1, &[m1, m2].concat()))
    }

    #[test]
    fn introducao_inclui_a_nota_que_leva_o_asterisco() {
        let h = converter(&hino_com_asterisco(), 1).unwrap();
        // O "*" está sobre a 2ª mínima do compasso 2 (começa em 6): a introdução vai até o FIM dela, 6 + 2 = 8 batidas.
        let intro = h.introducao.as_ref().expect("deveria ter introdução");
        assert_eq!(
            notas_de(intro, 0),
            vec![(0.0, 4.0, 60), (4.0, 2.0, 62), (6.0, 2.0, 64)]
        );
        // A passada normal continua inteira.
        assert_eq!(notas(&h, 0).len(), 3);
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("introdução") && a.contains("8")),
            "{:?}",
            h.avisos
        );
        let json = para_json(&h);
        assert_eq!(
            json["introducao"]["vozes"][0]["notas"],
            json!([[0.0, 4.0, 60], [4.0, 2.0, 62], [6.0, 2.0, 64]])
        );
    }

    /// O caso de 413 dos 480 hinos do Dó: "*", a última nota da introdução e a respiração que a fecha; depois a música continua.
    #[test]
    fn introducao_termina_junto_da_respiracao_e_nao_corta_a_ultima_nota() {
        let marca = "<StaffText><text>*</text></StaffText>";
        let m = format!(
            "<Measure><voice>{C44}{}{marca}{}<Breath/>{}</voice></Measure>",
            acorde("half", 62),
            acorde("quarter", 64),
            acorde("quarter", 65)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
        // 62 (0 a 2), "*" sobre o 64 (2 a 3), respiração aos 3 e o 65 já é da música.
        assert_eq!(
            notas_de(h.introducao.as_ref().expect("introdução"), 0),
            vec![(0.0, 2.0, 62), (2.0, 1.0, 64)]
        );
    }

    #[test]
    fn asterisco_sobre_uma_pausa_vai_ate_o_fim_dela() {
        let marca = "<StaffText><text>*</text></StaffText>";
        let m = format!(
            "<Measure><voice>{C44}{}{marca}<Rest><durationType>quarter</durationType></Rest>{}</voice></Measure>",
            acorde("half", 62),
            acorde("quarter", 64)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
        // a pausa (2 a 3) entra na introdução, mas não tem nota: só o 62 aparece, e o 64 (em 3) fica de fora
        assert_eq!(
            notas_de(h.introducao.as_ref().expect("introdução"), 0),
            vec![(0.0, 2.0, 62)]
        );
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("introdução") && a.contains("3")),
            "{:?}",
            h.avisos
        );
    }

    /// Revisão do Vandame (#89): um texto de pauta e uma cifra "*" antes da mesma nota fecham os dois no fim dela; nenhum fica com o começo da nota.
    #[test]
    fn dois_asteriscos_antes_da_mesma_nota_fecham_os_dois() {
        let m = format!(
            "<Measure><voice>{C44}{}<StaffText><text>*</text></StaffText><Harmony><name>*</name></Harmony>{}<Breath/>{}</voice></Measure>",
            acorde("half", 62),
            acorde("quarter", 64),
            acorde("quarter", 65)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
        assert_eq!(
            notas_de(h.introducao.as_ref().expect("introdução"), 0),
            vec![(0.0, 2.0, 62), (2.0, 1.0, 64)]
        );
    }

    /// Como no hino 250: o "*" vem depois de uma pausa invisível, um `tick` leva o tempo adiante e só então vem a respiração. A introdução termina na
    /// respiração, e não no "*" (que fica antes dela). O `tick` só vale na leitura por plano, então a regra é testada direto.
    #[test]
    fn respiracao_depois_do_asterisco_fecha_a_introducao_nela() {
        let mut asteriscos = vec![11.0, 20.0];
        let mut pendentes = vec![0usize, 1];
        fecha_asteriscos_na_respiracao(&mut asteriscos, &mut pendentes, 12.0);
        // o "*" de 11 fecha na respiração (12); o de 20 ainda é do futuro e continua esperando a sua nota
        assert_eq!(asteriscos, vec![12.0, 20.0]);
        assert_eq!(pendentes, vec![1]);
    }

    #[test]
    fn asterisco_logo_antes_da_respiracao_termina_onde_ela_esta() {
        let marca = "<StaffText><text>*</text></StaffText>";
        let m = format!(
            "<Measure><voice>{C44}{}{marca}<Breath/>{}</voice></Measure>",
            acorde("half", 62),
            acorde("half", 64)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
        assert_eq!(
            notas_de(h.introducao.as_ref().expect("introdução"), 0),
            vec![(0.0, 2.0, 62)]
        );
    }

    #[test]
    fn asterisco_como_cifra_harmony_tambem_vale() {
        let marca = "<Harmony><name>*</name></Harmony>";
        let m = format!(
            "<Measure><voice>{C44}{}{marca}{}</voice></Measure>",
            acorde("half", 62),
            acorde("half", 64)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
        assert_eq!(
            notas_de(h.introducao.as_ref().expect("deveria ter introdução"), 0),
            vec![(0.0, 2.0, 62), (2.0, 2.0, 64)]
        );
    }

    #[test]
    fn sem_asterisco_nao_ha_introducao() {
        let h = converter(&hino_com_final(), 1).unwrap();
        assert!(h.introducao.is_none());
        assert!(para_json(&h).get("introducao").is_none());
    }

    #[test]
    fn recortar_inicio_encurta_a_nota_que_atravessa_o_corte() {
        let v = |notas: Vec<(f64, f64, u8)>| Voz {
            nome: "S".into(),
            notas: notas
                .into_iter()
                .map(|(inicio, dur, midi)| Evento { inicio, dur, midi })
                .collect(),
        };
        let r = recortar_inicio(
            &[v(vec![(0.0, 3.0, 60), (2.0, 4.0, 62), (5.0, 1.0, 64)])],
            5.0,
        )
        .unwrap();
        assert_eq!(notas_de(&r, 0), vec![(0.0, 3.0, 60), (2.0, 3.0, 62)]);
        // sem nenhuma nota antes do corte não há introdução
        assert!(recortar_inicio(&[v(vec![(6.0, 1.0, 60)])], 5.0).is_none());
    }

    #[test]
    fn nomes_satb_tambem_vale_para_a_introducao() {
        let voz = |n: &str| Voz {
            nome: n.to_string(),
            notas: vec![],
        };
        let mut h = converter(&hino_com_asterisco(), 1).unwrap();
        h.vozes = vec![voz("Parte I")];
        h.introducao = Some(vec![voz("Parte I")]);
        nomes_satb(&mut h);
        assert_eq!(h.vozes[0].nome, "Soprano");
        assert_eq!(h.introducao.unwrap()[0].nome, "Soprano");
    }

    #[test]
    fn reconhece_o_padrao_de_final_e_gera_as_duas_passadas() {
        let h = converter(&hino_com_final(), 1).unwrap();
        // Passada normal: compassos 1 a 3 (até o fim da 1ª casa).
        assert_eq!(
            notas(&h, 0),
            vec![(0.0, 4.0, 60), (4.0, 4.0, 62), (8.0, 4.0, 64)]
        );
        // Passada do final: 1 e 2, pula a 1ª casa (3), toca a 2ª casa (4) e o trecho final (5 e 6),
        // sem buracos no tempo.
        let f = h
            .passada_final
            .as_ref()
            .expect("deveria ter passada do final");
        assert_eq!(
            notas_de(f, 0),
            vec![
                (0.0, 4.0, 60),
                (4.0, 4.0, 62),
                (8.0, 4.0, 65),
                (12.0, 4.0, 67),
                (16.0, 4.0, 69)
            ]
        );
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("estrutura de repetição reconhecida")),
            "{:?}",
            h.avisos
        );
        assert!(!h.avisos.iter().any(|a| a.contains("não reconhecida")));
    }

    #[test]
    fn passada_final_vai_para_o_json_e_mantem_as_vozes_na_mesma_ordem() {
        let h = converter(&hino_com_final(), 1).unwrap();
        let j = para_json(&h);
        assert_eq!(j["vozes"][0]["notas"].as_array().unwrap().len(), 3);
        assert_eq!(j["final"]["vozes"][0]["notas"].as_array().unwrap().len(), 5);
        assert_eq!(j["final"]["vozes"][0]["nome"], j["vozes"][0]["nome"]);
    }

    #[test]
    fn hino_sem_repeticao_nao_tem_passada_final() {
        let c = format!("{C44}{}", acorde("whole", 60));
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
        assert!(h.passada_final.is_none());
        assert!(para_json(&h).get("final").is_none());
    }

    #[test]
    fn estrutura_nao_reconhecida_le_em_ordem_e_avisa_em_vez_de_adivinhar() {
        // Só fim de repetição, sem casas de volta: não é o padrão confirmado.
        let medidas = [
            comp_marcado("<startRepeat/>", 60),
            comp_marcado("<endRepeat>2</endRepeat>", 62),
            comp_marcado("", 64),
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        assert!(h.passada_final.is_none());
        assert_eq!(notas(&h, 0).len(), 3); // lido uma vez, em ordem
        assert!(
            h.avisos.iter().any(|a| a.contains("não reconhecida")),
            "{:?}",
            h.avisos
        );

        // Três casas de volta também não é o padrão confirmado.
        let tres = [
            comp_marcado(r#"<startRepeat/><Volta id="1"><endings>1</endings></Volta>"#, 60),
            comp_marcado(r#"<endSpanner id="1"/><endRepeat>2</endRepeat><Volta id="2"><endings>2</endings></Volta>"#, 62),
            comp_marcado(r#"<endSpanner id="2"/><Volta id="3"><endings>3</endings></Volta>"#, 64),
            comp_marcado(r#"<endSpanner id="3"/>"#, 65),
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &tres)), 1).unwrap();
        assert!(h.passada_final.is_none());
    }

    #[test]
    fn selecionar_recorta_e_cola_sem_buracos_e_limita_a_duracao() {
        let a = |inicio: f64, dur: f64| Acorde {
            inicio,
            dur,
            notas: vec![(60, false, false)],
        };
        // compassos de 4 batidas: [0,4) [4,8) [8,12)
        let inicios = [0.0, 4.0, 8.0, 12.0];
        // uma nota que começa no compasso 2 e dura 6 batidas (passa do fim do segmento)
        let acordes = [a(0.0, 4.0), a(4.0, 6.0), a(8.0, 4.0)];
        let s = selecionar(&acordes, &inicios, &[(0, 1), (2, 3)]);
        let v: Vec<(f64, f64)> = s.iter().map(|x| (x.inicio, x.dur)).collect();
        assert_eq!(v, vec![(0.0, 4.0), (4.0, 4.0)]); // o compasso 2 saiu; o 3 foi colado logo depois
        let s = selecionar(&acordes, &inicios, &[(1, 2)]);
        assert_eq!((s[0].inicio, s[0].dur), (0.0, 4.0)); // duração cortada no fim do segmento (6 -> 4)
    }

    #[test]
    fn renomear_vozes_vale_tambem_para_a_passada_do_final() {
        let voz = |n: &str| Voz {
            nome: n.to_string(),
            notas: vec![],
        };
        let partes = || {
            vec![
                voz("Parte I"),
                voz("Parte II"),
                voz("Parte III"),
                voz("Parte IV"),
            ]
        };
        let mut h = Hino {
            numero: 1,
            titulo: "T".into(),
            autoria: None,
            passada_final: Some(partes()),
            introducao: Some(partes()),
            andamento: None,
            armadura: 0,
            modo: "maior",
            vozes: partes(),
            letra: vec![],
            sincronia: None,
            compassos: None,
            avisos: vec![],
        };
        nomes_satb(&mut h);
        let normal: Vec<_> = h.vozes.iter().map(|v| v.nome.clone()).collect();
        let final_: Vec<_> = h
            .passada_final
            .unwrap()
            .iter()
            .map(|v| v.nome.clone())
            .collect();
        assert_eq!(normal, vec!["Soprano", "Contralto", "Tenor", "Baixo"]);
        assert_eq!(
            final_, normal,
            "as vozes do final devem ter os mesmos nomes, na mesma ordem"
        );
    }

    /// Sílaba como no MuseScore 2; `texto_xml` pode ter formatação interna (ex.: `<sym>`).
    fn sil(sy: &str, texto_xml: &str) -> String {
        let sy = if sy.is_empty() {
            String::new()
        } else {
            format!("<syllabic>{sy}</syllabic>")
        };
        format!("<Lyrics>{sy}<text>{texto_xml}</text></Lyrics>")
    }
    fn acorde_letra(pitch: u8, letras: &str) -> String {
        format!(
            "<Chord><durationType>quarter</durationType>{letras}<Note><pitch>{pitch}</pitch></Note></Chord>"
        )
    }
    fn letra_de(chords: &[String]) -> Vec<String> {
        let c = format!("{C44}{}", chords.concat());
        converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1)
            .unwrap()
            .letra
    }

    #[test]
    fn elisao_vira_espaco_e_nao_perde_as_letras() {
        // Elisão do MuseScore: <text>to<sym>lyricsElisionWide</sym>a</text> = "to a" numa nota só.
        let letra = letra_de(&[
            acorde_letra(60, &sil("begin", "Ba")),
            acorde_letra(62, &sil("middle", "ra")),
            acorde_letra(64, &sil("middle", "to<sym>lyricsElisionWide</sym>a")),
            acorde_letra(65, &sil("end", "li")),
        ]);
        assert_eq!(letra, vec!["1. Barato ali"]);
    }

    #[test]
    fn numero_de_estrofe_escrito_na_primeira_silaba_nao_duplica() {
        // A primeira sílaba traz o número da estrofe: "1. Pa".
        let letra = letra_de(&[
            acorde_letra(60, &sil("", "1. Pa")),
            acorde_letra(62, &sil("", "ra,")),
            acorde_letra(64, &sil("", "meu")),
        ]);
        assert_eq!(letra, vec!["1. Pa ra, meu"]);
    }

    #[test]
    fn duas_silabas_diferentes_no_mesmo_instante_ficam_so_a_repetida_de_outra_camada_sai() {
        // mesma camada, mesmo instante, textos diferentes: as duas ficam
        let duas = format!("{}{}", sil("", "a"), sil("", "b"));
        assert_eq!(letra_de(&[acorde_letra(60, &duas)]), vec!["1. a b"]);
        // textos diferentes em camadas diferentes no mesmo instante também ficam (não é duplicata)
        let c = format!(
            "{C44}{}<tick>0</tick><Chord><track>1</track><durationType>quarter</durationType>{}<Note><pitch>55</pitch></Note></Chord>",
            acorde_letra(60, &sil("", "a")),
            sil("", "b")
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
        assert_eq!(h.letra, vec!["1. a b"]);
    }

    #[test]
    fn so_o_nome_de_simbolo_comum_e_ignorado_e_o_titulo_tambem_entende_elisao() {
        let m = format!(
            "<VBox>{}</VBox>",
            texto_moldura(
                "Title",
                "a<sym>lyricsElisionWide</sym>b e c<sym>fermataAbove</sym>d"
            )
        );
        let h = converter(&doc_com_moldura(&m), 1).unwrap();
        assert_eq!(h.titulo, "a b e cd"); // elisão vira espaço; outro símbolo some sem deixar o nome
    }

    #[test]
    fn sem_numero_inicial_so_tira_numero_seguido_de_ponto() {
        assert_eq!(sem_numero_inicial("1. Pa"), "Pa");
        assert_eq!(sem_numero_inicial("  12.Pa"), "Pa");
        assert_eq!(sem_numero_inicial("1."), "");
        assert_eq!(sem_numero_inicial("Pa"), "Pa");
        assert_eq!(sem_numero_inicial("3 meu"), "3 meu"); // sem ponto: é texto
        assert_eq!(sem_numero_inicial("a1. b"), "a1. b");
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
            format!(
                "<Chord><durationType>half</durationType><Note><pitch>{b}</pitch></Note><Note><pitch>{a}</pitch></Note></Chord>"
            )
        };
        let c = format!("{C44}{}{}", duas(60, 67), acorde("half", 65)); // 2º acorde: uníssono
        let h = converter(
            &doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))),
            1,
        )
        .unwrap();
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
        let s1 = pauta(
            1,
            &format!("<Measure><voice>{C44}{v1}</voice><voice>{v2}</voice></Measure>"),
        );
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
        let c = format!(
            "<Measure><startRepeat/><voice>{C44}{}</voice></Measure>",
            acorde("whole", 60)
        );
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &c)), 1).unwrap();
        assert!(h.avisos[0].contains("repetições"));
        assert!(converter("<x/>", 1).unwrap_err().contains("falta <Score>"));
        assert!(
            converter("{ não é xml", 1)
                .unwrap_err()
                .contains("XML inválido")
        );
        assert!(
            converter(&doc("", &pauta(1, &compasso(C44))), 1)
                .unwrap_err()
                .contains("nenhuma nota")
        );
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

    // ---- Compassos de cada fluxo (I-12, fase B: destacar o compasso na partitura) ----

    /// Onde as notas de cada compasso caem na régua do fluxo: para cada compasso listado, a nota que começa no instante dele tem de ser a do
    /// compasso certo (cada compasso dos hinos de teste tem uma altura própria, que o índice do compasso identifica).
    fn altura_do_compasso(i: usize) -> u8 {
        [60, 62, 64, 65, 67, 69][i]
    }

    #[test]
    fn sem_repeticao_cada_compasso_da_partitura_entra_uma_vez_e_em_ordem() {
        let h = converter(&hino_com_asterisco(), 1).unwrap();
        let c = h.compassos.expect("deveria ter compassos");
        assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1)]);
        assert!(
            c.passada_final.is_none(),
            "sem final, sem compassos do final"
        );
    }

    #[test]
    fn introducao_inclui_o_compasso_que_contem_o_asterisco() {
        // O "*" está no meio do compasso 2 (a 6 batidas): o compasso 2 começa antes dele e entra.
        let h = converter(&hino_com_asterisco(), 1).unwrap();
        let c = h.compassos.unwrap();
        assert_eq!(c.introducao, Some(vec![(0.0, 0), (4.0, 1)]));
    }

    #[test]
    fn introducao_que_termina_no_fim_de_um_compasso_nao_inclui_o_seguinte() {
        let marca = "<StaffText><text>*</text></StaffText>";
        let m1 = format!(
            "<Measure><voice>{C44}{}{marca}</voice></Measure>",
            acorde("whole", 60)
        );
        let m2 = comp_marcado("", 62);
        let m3 = comp_marcado("", 64);
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &[m1, m2, m3].concat())), 1).unwrap();
        // o "*" fica no fim do compasso 1 (4 batidas): o compasso 2 começa EM 4, e não antes, então não é da introdução
        let c = h.compassos.unwrap();
        assert_eq!(c.introducao, Some(vec![(0.0, 0)]));
        assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
    }

    #[test]
    fn sem_asterisco_nao_ha_compassos_da_introducao() {
        let h = converter(&hino_com_final(), 1).unwrap();
        assert!(h.compassos.unwrap().introducao.is_none());
    }

    #[test]
    fn com_final_a_passada_normal_e_a_do_final_seguem_o_plano_de_repeticao() {
        let h = converter(&hino_com_final(), 1).unwrap();
        let c = h.compassos.expect("deveria ter compassos");
        // normal: compassos 0, 1 e 2 (até o fim da 1ª casa); final: 0 e 1, pula a 1ª casa (2) e segue com 3, 4 e 5. Os instantes são os da régua
        // de cada passada (4 batidas por compasso, sem buracos).
        assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
        assert_eq!(
            c.passada_final,
            Some(vec![(0.0, 0), (4.0, 1), (8.0, 3), (12.0, 4), (16.0, 5)])
        );
    }

    #[test]
    fn o_instante_de_cada_compasso_e_onde_as_notas_dele_caem_em_cada_passada() {
        let h = converter(&hino_com_final(), 1).unwrap();
        let c = h.compassos.clone().unwrap();
        let normal = notas_de(&h.vozes, 0);
        for &(t, i) in &c.normal {
            let n = normal
                .iter()
                .find(|n| (n.0 - t).abs() < 1e-9)
                .expect("há uma nota começando no compasso");
            assert_eq!(
                n.2,
                altura_do_compasso(i),
                "passada normal, compasso {i} em {t}"
            );
        }
        let final_ = notas_de(h.passada_final.as_ref().unwrap(), 0);
        for &(t, i) in c.passada_final.as_ref().unwrap() {
            let n = final_
                .iter()
                .find(|n| (n.0 - t).abs() < 1e-9)
                .expect("há uma nota começando no compasso");
            assert_eq!(
                n.2,
                altura_do_compasso(i),
                "passada do final, compasso {i} em {t}"
            );
        }
        // e não sobra compasso sem nota nem nota sem compasso: um compasso por nota (cada compasso do teste tem uma semibreve)
        assert_eq!(c.normal.len(), normal.len());
        assert_eq!(c.passada_final.as_ref().unwrap().len(), final_.len());
    }

    #[test]
    fn estrutura_nao_reconhecida_le_a_partitura_uma_vez_em_ordem_tambem_nos_compassos() {
        // um fim de repetição sem as casas de volta que o plano reconhece: a partitura é lida uma vez, como as notas
        let medidas = [
            comp_marcado("<startRepeat/>", 60),
            comp_marcado("<endRepeat>2</endRepeat>", 62),
            comp_marcado("", 64),
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        let c = h.compassos.unwrap();
        assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
        assert!(c.passada_final.is_none());
    }

    #[test]
    fn anacruse_o_compasso_curto_empurra_os_seguintes_pela_duracao_real() {
        // 1º compasso de 1 batida (len="1/4"), depois dois de 4: os instantes são 0, 1 e 5 (e não 0, 4 e 8)
        let anacruse = format!(
            r#"<Measure len="1/4"><voice>{C44}{}</voice></Measure>"#,
            acorde("quarter", 60)
        );
        let h = converter(
            &doc(
                &parte(1, "S"),
                &pauta(
                    1,
                    &[anacruse, comp_marcado("", 62), comp_marcado("", 64)].concat(),
                ),
            ),
            1,
        )
        .unwrap();
        assert_eq!(
            h.compassos.unwrap().normal,
            vec![(0.0, 0), (1.0, 1), (5.0, 2)]
        );
    }

    #[test]
    fn o_json_traz_os_compassos_de_cada_fluxo_e_omite_o_que_nao_existe() {
        let j = para_json(&converter(&hino_com_final(), 1).unwrap());
        assert_eq!(
            j["compassos"]["normal"],
            json!([[0.0, 0], [4.0, 1], [8.0, 2]])
        );
        assert_eq!(
            j["compassos"]["final"],
            json!([[0.0, 0], [4.0, 1], [8.0, 3], [12.0, 4], [16.0, 5]])
        );
        assert!(j["compassos"].get("introducao").is_none());
        let j2 = para_json(&converter(&hino_com_asterisco(), 1).unwrap());
        assert_eq!(j2["compassos"]["introducao"], json!([[0.0, 0], [4.0, 1]]));
        assert!(j2["compassos"].get("final").is_none());
    }

    #[test]
    fn final_descartado_nao_deixa_compassos_do_final() {
        // O último compasso (só existe na passada do final) tem um acorde de 2 notas: o final teria 2 vozes e a normal 1, então o final é
        // descartado (ver o aviso). Os compassos do final têm de sumir junto: sem notas do final, o app não tem o que destacar.
        let ultimo = format!(
            "<Measure><voice>{C44}<Chord><durationType>whole</durationType><Note><pitch>69</pitch></Note><Note><pitch>72</pitch></Note></Chord></voice></Measure>"
        );
        let medidas = [
            comp_marcado("<startRepeat/>", 60),
            comp_marcado("", 62),
            comp_marcado(
                r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
                64,
            ),
            comp_marcado(
                r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
                65,
            ),
            comp_marcado(r#"<endSpanner id="2"/>"#, 67),
            ultimo,
        ]
        .concat();
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
        assert!(
            h.passada_final.is_none(),
            "o final deveria ter sido descartado: {:?}",
            h.avisos
        );
        assert!(
            h.avisos.iter().any(|a| a.contains("descartado")),
            "{:?}",
            h.avisos
        );
        let c = h.compassos.unwrap();
        assert!(c.passada_final.is_none());
        assert_eq!(
            c.normal,
            vec![(0.0, 0), (4.0, 1), (8.0, 2)],
            "a passada normal segue com o plano"
        );
        assert!(para_json(&converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap())["compassos"].get("final").is_none());
    }

    #[test]
    fn hino_sem_compassos_nao_tem_o_campo() {
        let mut h = converter(&hino_com_asterisco(), 1).unwrap();
        h.compassos = None;
        assert!(para_json(&h).get("compassos").is_none());
    }

    #[test]
    fn compassos_da_passada_desloca_cada_intervalo_pelo_acumulado() {
        // 4 compassos de 2 batidas; passada = compassos [0,1) e [2,4): o 2º intervalo recomeça em 2 (acumulado), e não em 4
        let inicios = [0.0, 2.0, 4.0, 6.0, 8.0];
        assert_eq!(
            compassos_da_passada(&inicios, &[(0, 1), (2, 4)]),
            vec![(0.0, 0), (2.0, 2), (4.0, 3)]
        );
        assert_eq!(
            compassos_da_passada(&inicios, &[(0, 4)]),
            vec![(0.0, 0), (2.0, 1), (4.0, 2), (6.0, 3)]
        );
        assert!(compassos_da_passada(&inicios, &[]).is_empty());
    }

    #[test]
    fn compassos_da_introducao_com_poucos_inicios_nao_estoura() {
        assert!(compassos_da_introducao(&[], 5.0).is_empty());
        assert!(compassos_da_introducao(&[0.0], 5.0).is_empty()); // só o "fim da partitura", sem nenhum compasso
        assert_eq!(
            compassos_da_introducao(&[0.0, 4.0, 8.0], 6.0),
            vec![(0.0, 0), (4.0, 1)]
        );
    }

    // ---- Tonalidade (I-13): armadura, modo e nome ----
    fn com_armadura(ks: &str, baixo: &[u8]) -> Hino {
        let corpo_s = format!("{C44}{ks}{}", acorde("whole", 72));
        let corpo_b: String = baixo.iter().map(|&p| acorde("quarter", p)).collect();
        let pautas = format!(
            "{}{}",
            pauta(1, &compasso(&corpo_s)),
            pauta(2, &compasso(&format!("{C44}{corpo_b}")))
        );
        let partes = format!("{}{}", parte(1, "Soprano"), parte(2, "Baixo"));
        converter(&doc(&partes, &pautas), 1).unwrap()
    }
    fn ks(n: i8) -> String {
        format!("<KeySig><accidental>{n}</accidental></KeySig>")
    }

    #[test]
    fn tonica_e_nome_de_todas_as_armaduras() {
        // (armadura, tônica maior, nome maior, tônica menor, nome menor)
        let t = [
            (-7, 11, "Dó♭", 8, "Lá♭"),
            (-6, 6, "Sol♭", 3, "Mi♭"),
            (-5, 1, "Ré♭", 10, "Si♭"),
            (-4, 8, "Lá♭", 5, "Fá"),
            (-3, 3, "Mi♭", 0, "Dó"),
            (-2, 10, "Si♭", 7, "Sol"),
            (-1, 5, "Fá", 2, "Ré"),
            (0, 0, "Dó", 9, "Lá"),
            (1, 7, "Sol", 4, "Mi"),
            (2, 2, "Ré", 11, "Si"),
            (3, 9, "Lá", 6, "Fá♯"),
            (4, 4, "Mi", 1, "Dó♯"),
            (5, 11, "Si", 8, "Sol♯"),
            (6, 6, "Fá♯", 3, "Ré♯"),
            (7, 1, "Dó♯", 10, "Lá♯"),
        ];
        for (a, pm, nm, pn, nn) in t {
            assert_eq!(tonica_pc(a, false), pm, "maior {a}");
            assert_eq!(tonica_pc(a, true), pn, "menor {a}");
            assert_eq!(nome_da_tonalidade(a, "maior"), format!("{nm} maior"));
            assert_eq!(nome_da_tonalidade(a, "menor"), format!("{nn} menor"));
        }
    }

    #[test]
    fn armadura_e_modo_maior_pelo_baixo() {
        let h = com_armadura(&ks(-3), &[51, 55, 58, 51]); // Mi♭ no fim
        assert_eq!((h.armadura, h.modo), (-3, "maior"));
        let j = para_json(&h);
        assert_eq!(
            (
                j["armadura"].clone(),
                j["modo"].clone(),
                j["tonalidade"].clone()
            ),
            (json!(-3), json!("maior"), json!("Mi♭ maior"))
        );
        assert!(!h.avisos.iter().any(|a| a.contains("tonalidade")));
    }

    #[test]
    fn hino_menor_pelo_baixo() {
        let h = com_armadura(&ks(-3), &[48, 55, 51, 48]); // Dó no fim
        assert_eq!((h.armadura, h.modo), (-3, "menor"));
        assert_eq!(para_json(&h)["tonalidade"], json!("Dó menor"));
    }

    #[test]
    fn sem_keysig_a_armadura_e_zero() {
        let h = com_armadura("", &[48, 55, 48]);
        assert_eq!((h.armadura, h.modo), (0, "maior"));
        let h = com_armadura("", &[57, 52, 57]); // Lá no fim
        assert_eq!((h.armadura, h.modo), (0, "menor"));
    }

    #[test]
    fn baixo_que_nao_bate_usa_a_primeira_nota_e_depois_assume_maior_com_aviso() {
        // fim em Ré (nada), primeira em Dó (maior de armadura 0)
        let h = com_armadura("", &[48, 55, 50]);
        assert_eq!(h.modo, "maior");
        assert!(!h.avisos.iter().any(|a| a.contains("tonalidade")));
        // nem o fim nem o começo batem
        let h = com_armadura("", &[50, 55, 53]);
        assert_eq!(h.modo, "maior");
        assert!(
            h.avisos.iter().any(|a| a.contains("tonalidade")),
            "{:?}",
            h.avisos
        );
    }

    #[test]
    fn modo_escrito_no_arquivo_vale_mais_que_o_baixo() {
        let k = "<KeySig><accidental>-3</accidental><mode>minor</mode></KeySig>";
        let h = com_armadura(k, &[51, 55, 51]);
        assert_eq!(h.modo, "menor");
    }

    #[test]
    fn armadura_invalida_vira_zero_com_aviso_e_so_o_primeiro_keysig_vale() {
        let h = com_armadura(&ks(9), &[48, 48]);
        assert_eq!(h.armadura, 0);
        assert!(
            h.avisos.iter().any(|a| a.contains("armadura inválida (9)")),
            "{:?}",
            h.avisos
        );
        let h = com_armadura("<KeySig><accidental>x</accidental></KeySig>", &[48, 48]);
        assert!(h.avisos.iter().any(|a| a.contains("armadura inválida (x)")));
        // KeySig sem número (o 0 pode vir omitido): Dó, sem aviso.
        let h = com_armadura("<KeySig></KeySig>", &[48, 48]);
        assert_eq!(h.armadura, 0);
        assert!(!h.avisos.iter().any(|a| a.contains("armadura")));
        let dois = format!("{}{}", ks(1), ks(-2));
        let h = com_armadura(&dois, &[55, 55]);
        assert_eq!((h.armadura, h.modo), (1, "maior"));
    }
}
