//! O JSON de saída do hino.

use crate::modelo::{Compassos, EstrofeSinc, Hino, Sincronia, Voz, arredondar};
use crate::tonalidade::nome_da_tonalidade;
use serde_json::{Map, Value, json};

/// Um campo do objeto JSON, para entrar com `Map::extend` só quando existe (`Option` é um iterador de zero ou um).
fn campo(chave: &str, valor: Value) -> (String, Value) {
    (chave.to_string(), valor)
}

fn sincronia_json(s: &Sincronia) -> Value {
    let mut o = Map::new();
    o.insert("normal".into(), json!(estrofes_json(&s.normal)));
    o.extend(
        s.passada_final
            .as_ref()
            .map(|f| campo("final", json!(estrofes_json(f)))),
    );
    Value::Object(o)
}

fn compassos_json(c: &Compassos) -> Value {
    let mut o = Map::new();
    o.insert("normal".into(), json!(c.normal));
    o.extend(c.passada_final.as_ref().map(|f| campo("final", json!(f))));
    o.extend(c.introducao.as_ref().map(|i| campo("introducao", json!(i))));
    Value::Object(o)
}

pub fn para_json(h: &Hino) -> Value {
    let mut m = Map::new();
    m.insert("numero".into(), json!(h.numero));
    m.insert("titulo".into(), json!(h.titulo));
    m.extend(h.autoria.as_ref().map(|a| campo("autoria", json!(a))));
    m.extend(h.andamento.map(|a| campo("andamento", json!(a))));
    m.insert("armadura".into(), json!(h.armadura));
    m.insert("modo".into(), json!(h.modo));
    m.insert(
        "tonalidade".into(),
        json!(nome_da_tonalidade(h.armadura, h.modo)),
    );
    m.extend((!h.letra.is_empty()).then(|| campo("letra", json!(h.letra))));
    m.insert("vozes".into(), Value::Array(vozes_json(&h.vozes)));
    let com_vozes = |v: &Vec<Voz>| json!({ "vozes": vozes_json(v) });
    m.extend(
        h.passada_final
            .as_ref()
            .map(|f| campo("final", com_vozes(f))),
    );
    m.extend(
        h.introducao
            .as_ref()
            .map(|i| campo("introducao", com_vozes(i))),
    );
    m.extend(
        h.sincronia
            .as_ref()
            .map(|s| campo("sincronia", sincronia_json(s))),
    );
    m.extend(
        h.compassos
            .as_ref()
            .map(|c| campo("compassos", compassos_json(c))),
    );
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
