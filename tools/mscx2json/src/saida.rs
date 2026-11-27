//! O JSON de saída do hino.

use crate::modelo::{EstrofeSinc, Hino, Voz, arredondar};
use crate::tonalidade::nome_da_tonalidade;
use serde_json::{Map, Value, json};

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

pub(crate) fn estrofes_json(estrofes: &[EstrofeSinc]) -> Vec<Value> {
    estrofes
        .iter()
        .map(|e| json!({ "estrofe": e.estrofe, "linhas": e.linhas }))
        .collect()
}

pub(crate) fn vozes_json(vozes: &[Voz]) -> Vec<Value> {
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
pub(crate) fn cabecalho(id: &str, nome: &str, idioma: Option<&str>) -> Value {
    let mut m = Map::new();
    m.insert("id".into(), json!(id));
    m.insert("nome".into(), json!(nome));
    if let Some(i) = idioma.filter(|i| !i.trim().is_empty()) {
        m.insert("idioma".into(), json!(i.trim()));
    }
    Value::Object(m)
}
