//! Pistas do texto para a quebra de linha da letra: onde um verso começa.

use crate::percurso::Silaba;

/// Palavras que levam inicial maiúscula por reverência (nomes divinos e pronomes de tratamento), e não por começarem um verso.
pub(crate) const REVERENCIAIS: &[&str] = &[
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
pub(crate) fn primeira_palavra(texto: &str) -> String {
    texto
        .chars()
        .skip_while(|c| !c.is_alphabetic())
        .take_while(|c| c.is_alphabetic())
        .collect()
}

/// A palavra que começa na sílaba `i`: ela mais as seguintes da mesma estrofe enquanto a palavra continua ("Je" + "sus").
pub(crate) fn palavra_a_partir(silabas: &[Silaba], i: usize) -> String {
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

pub(crate) fn termina_com_pontuacao(linha: &str) -> bool {
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
pub(crate) fn comeca_verso(palavra: &str, linha_anterior: &str) -> bool {
    let p = primeira_palavra(palavra);
    if !p.chars().next().is_some_and(char::is_uppercase) {
        return false;
    }
    !(REVERENCIAIS.contains(&p.as_str()) && !termina_com_pontuacao(linha_anterior))
}
