//! As partituras (SVG) do pacote de exemplo, embutidas no binário junto do `exemplo/hinario.json`.
//!
//! São as de `exemplo/partituras/` (geradas por `tools/gerar-exemplo.py` das edições de domínio público do Mutopia; ver
//! docs/licencas-de-terceiros.md). Servem só enquanto o app mostra o exemplo (nenhum hinário instalado): com um hinário instalado, as
//! partituras vêm do disco (`pacote.rs`). Cada uma passa pela MESMA limpeza (`svg::limpar`) das partituras instaladas, a cada leitura.

use crate::hinario::erro;
use crate::{pacote, svg};
use std::path::Path;

/// (número do hino, retrato, paisagem).
const PARTITURAS: [(u32, &str, &str); 5] = [
    (1, include_str!("../exemplo/partituras/hino-1.svg"), include_str!("../exemplo/partituras/hino-1-paisagem.svg")),
    (2, include_str!("../exemplo/partituras/hino-2.svg"), include_str!("../exemplo/partituras/hino-2-paisagem.svg")),
    (3, include_str!("../exemplo/partituras/hino-3.svg"), include_str!("../exemplo/partituras/hino-3-paisagem.svg")),
    (4, include_str!("../exemplo/partituras/hino-4.svg"), include_str!("../exemplo/partituras/hino-4-paisagem.svg")),
    (5, include_str!("../exemplo/partituras/hino-5.svg"), include_str!("../exemplo/partituras/hino-5-paisagem.svg")),
];

/// Os números dos hinos do exemplo que têm partitura embutida, em ordem.
pub fn numeros() -> Vec<u32> {
    PARTITURAS.iter().map(|(n, _, _)| *n).collect()
}

/// O SVG (limpo) do hino `numero`, na versão da tela (`paisagem` pede a larga). Hino sem partitura embutida: erro `sem_partitura`.
pub fn ler(numero: u32, paisagem: bool) -> Result<String, String> {
    let Some((_, retrato, larga)) = PARTITURAS.iter().find(|(n, _, _)| *n == numero) else {
        return Err(erro("sem_partitura", &[numero.to_string()]));
    };
    let bruto = if paisagem { larga } else { retrato };
    svg::limpar(bruto).map_err(|motivo| erro("partitura_invalida", &[numero.to_string(), motivo]))
}

/// A partitura que o comando `ler_partitura` entrega: sem hinário instalado (`hinario.json` ausente em `dir`) vale a embutida do exemplo; com
/// hinário instalado, só a do disco (a embutida não vaza para o hino de mesmo número de outro hinário).
pub fn ler_partitura_do_app(dir: &Path, numero: u32, paisagem: bool) -> Result<String, String> {
    if dir.join("hinario.json").is_file() {
        pacote::ler_partitura(dir, numero, paisagem)
    } else {
        ler(numero, paisagem)
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn as_cinco_partituras_passam_na_limpeza_nas_duas_versoes() {
        assert_eq!(numeros(), [1, 2, 3, 4, 5]);
        for n in numeros() {
            for paisagem in [false, true] {
                let svg = ler(n, paisagem).unwrap_or_else(|e| panic!("hino {n} (paisagem: {paisagem}): {e}"));
                assert!(svg.starts_with("<svg") && svg.contains("class=\"measure\""), "hino {n}");
            }
        }
    }

    #[test]
    fn as_notas_levam_o_tempo_que_o_karaoke_le() {
        let svg = ler(1, false).unwrap();
        assert!(svg.contains("class=\"note\" data-t=\"") && svg.contains(" data-f=\""));
    }

    #[test]
    fn hino_sem_partitura_embutida_e_erro_de_sem_partitura() {
        let e = ler(6, false).unwrap_err();
        assert!(e.contains("sem_partitura"), "{e}");
    }

    #[test]
    fn so_sem_hinario_instalado_a_partitura_vem_do_exemplo() {
        let d = std::env::temp_dir().join(format!("bm_exemplo_{}", std::process::id()));
        std::fs::remove_dir_all(&d).ok();
        std::fs::create_dir_all(&d).unwrap();
        assert!(ler_partitura_do_app(&d, 1, true).unwrap().starts_with("<svg"));
        std::fs::write(d.join("hinario.json"), "{}").unwrap();
        let e = ler_partitura_do_app(&d, 1, false).unwrap_err();
        assert!(e.contains("sem_partitura"), "{e}");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn o_exemplo_carregado_lista_as_partituras_embutidas() {
        let p = crate::hinario::carregar(None).unwrap();
        assert!(p.exemplo && p.partituras == numeros());
    }
}
