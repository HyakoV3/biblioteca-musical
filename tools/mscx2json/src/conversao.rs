//! A conversão de um arquivo `.mscx` para o hino.

use crate::coro::{separar_o_final, separar_sem_plano};
use crate::correcoes;
use crate::estrutura::{
    Estrutura, Plano, compassos_da_introducao, compassos_da_passada, plano_passadas,
    recortar_inicio, registrar_marcas, selecionar,
};
use crate::modelo::{Compassos, Hino, Marca, Sincronia, Voz, arredondar};
use crate::montagem::montar_letra;
use crate::partes::nome_da_voz;
use crate::percurso::{Acorde, Estado, Silaba, percorrer};
use crate::sincronia::estrofes_da_passada;
use crate::tonalidade::{ler_armadura, modo_pelo_baixo, nome_da_tonalidade};
use crate::vozes::dividir_em_vozes;
use crate::xml::{filho, fracao, numero, texto, texto_completo, texto_de_estilo};
use roxmltree::{Document, Node};
use std::collections::{BTreeMap, HashMap};

#[cfg(test)]
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
    // Por pauta, as notas antes do recorte do plano: (nome-base, sufixo, camadas).
    // A letra (sílabas e respirações) depois das correções e antes da separação do final.
    let mut letra_base: Option<(Vec<Silaba>, Vec<f64>)> = None;
    // Avisos da leitura recortada pelo plano (notas omitidas): só valem se o final for aceito.
    let mut avisos_do_recorte: Vec<String> = vec![];
    let mut pautas_guardadas: Vec<(String, String, Vec<Vec<Acorde>>)> = vec![];
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
            // Guarda a letra já corrigida, antes de separar o final: se o final for descartado, a letra é refeita sem o plano.
            letra_base = Some((silabas.clone(), respiracoes.clone()));
            if let Some(&(a2, _)) = plano.as_ref().and_then(|p| p.final_.last()) {
                let no_final = separar_o_final(&mut silabas, estrutura.inicios[a2]);
                if no_final > 0 {
                    avisos.push(format!(
                        "final separado: {no_final} sílabas cantadas só na última vez viraram o bloco \"Final\""
                    ));
                }
            } else {
                separar_sem_plano(&mut silabas, &mut avisos);
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
        if plano.is_some() {
            // Guarda as notas inteiras: se o final for descartado, as vozes são refeitas com a leitura única (ver abaixo).
            pautas_guardadas.push((base.clone(), sufixo.clone(), camadas.clone()));
        }
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
        let nome_da_voz = |r: usize, max: usize| nome_da_voz(&base, &sufixo, &partes, r, max);

        let (linhas, omitidos) = dividir_em_vozes(normal, limite);
        // Com o plano, a contagem é a da leitura recortada: só vale se o final for aceito (ver `final_descartado`).
        let destino = if plano.is_some() {
            &mut avisos_do_recorte
        } else {
            &mut avisos
        };
        if omitidos > 0 {
            destino.push(format!(
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
                avisos_do_recorte.push(format!(
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
    // MSCX-002: com o final descartado (as vozes do final não casam com as da passada normal), a passada normal NÃO pode ficar cortada na 1ª casa:
    // perderia a 2ª casa e o trecho final, que a partitura manda tocar. Refaz as vozes com a leitura única, em ordem, como numa partitura sem plano.
    let final_descartado = plano.is_some() && !(final_ok && !vozes_final.is_empty());
    if !final_descartado {
        avisos.append(&mut avisos_do_recorte);
    }
    if final_descartado {
        plano = None;
        vozes.clear();
        for (base, sufixo, camadas) in std::mem::take(&mut pautas_guardadas) {
            let partes: Vec<&str> = base.split(" e ").collect();
            let limite = (partes.len() > 1).then_some(partes.len());
            let (linhas, omitidos) = dividir_em_vozes(camadas, limite);
            let max = linhas.len();
            for (r, notas) in linhas.into_iter().enumerate() {
                vozes.push(Voz {
                    nome: nome_da_voz(&base, &sufixo, &partes, r, max),
                    notas,
                });
            }
            if omitidos > 0 {
                avisos.push(format!(
                    "{base}{sufixo}: {omitidos} trecho(s) com mais notas simultâneas que vozes; notas do meio omitidas"
                ));
            }
        }
        // A letra também volta ao caminho sem plano (coro e refrão trocado, sem o bloco "Final").
        if let Some((mut sil, resp)) = letra_base.take() {
            avisos.retain(|a| !a.starts_with("final separado:"));
            separar_sem_plano(&mut sil, &mut avisos);
            (letra, marcas) = montar_letra(sil, resp);
        }
        avisos.push(
            "final descartado: a partitura é lida uma vez, em ordem (com a 2ª casa e o trecho final), e não só até a 1ª casa".to_string(),
        );
    }
    if let Some(p) = &plano {
        avisos.push(format!(
            "estrutura de repetição reconhecida: {}",
            p.descricao
        ));
    } else if !final_descartado
        && doc.descendants().any(|n| {
            matches!(
                n.tag_name().name(),
                "startRepeat" | "endRepeat" | "Jump" | "Volta"
            )
        })
    {
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
