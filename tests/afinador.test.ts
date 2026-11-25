import { describe, expect, it } from "vitest";
import {
  LA_PADRAO,
  leituraComHisterese,
  mediana,
  notaEscrita,
  palavraDeAfinacao,
  posicaoNaTrilha,
  vizinhas,
  OITAVA_MAX,
  OITAVA_MIN,
  OITAVA_PADRAO,
  centsEntre,
  classeDe,
  frequenciaDe,
  limitarOitava,
  midiDe,
  nomeDaNota,
  nomeDaNotaPorExtenso,
  notaMaisProxima,
} from "../src/lib/afinador";

describe("nome das notas", () => {
  it("12 notas com a grafia fixa, em cada idioma", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => nomeDaNota(n, "pt"))).toEqual(
      ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Lá♭", "Lá", "Si♭", "Si"],
    );
    expect(nomeDaNota(3, "en")).toBe("E♭");
    expect(nomeDaNota(9, "en")).toBe("A");
    expect(nomeDaNota(0, "es")).toBe("Do");
    expect(nomeDaNota(8, "es")).toBe("La♭");
  });

  it("os nomes por extenso (para o leitor de tela) não levam símbolo", () => {
    for (const idioma of ["pt", "en", "es"] as const) {
      for (let n = 0; n < 12; n++) expect(nomeDaNotaPorExtenso(n, idioma), `${idioma} ${n}`).not.toMatch(/[♭♯]/);
    }
    expect(nomeDaNotaPorExtenso(3, "pt")).toBe("Mi bemol");
    expect(nomeDaNotaPorExtenso(6, "pt")).toBe("Fá sustenido");
    expect(nomeDaNotaPorExtenso(1, "en")).toBe("C sharp");
    expect(nomeDaNotaPorExtenso(10, "es")).toBe("Si bemol");
  });

  it("a classe fica de 0 a 11, também com número negativo ou fora da faixa", () => {
    expect(classeDe(12)).toBe(0);
    expect(classeDe(-1)).toBe(11);
    expect(classeDe(-13)).toBe(11);
    expect(classeDe(61)).toBe(1);
    expect(nomeDaNota(-3, "pt")).toBe("Lá"); // -3 é Lá (9)
    expect(nomeDaNota(21, "pt")).toBe("Lá");
  });
});

describe("oitava", () => {
  it("fica dentro da faixa oferecida e o que não é número volta à padrão", () => {
    expect(limitarOitava(0)).toBe(OITAVA_MIN);
    expect(limitarOitava(99)).toBe(OITAVA_MAX);
    expect(limitarOitava(3.6)).toBe(4);
    for (const ruim of [NaN, Infinity, "4", null, undefined, {}, []]) expect(limitarOitava(ruim), String(ruim)).toBe(OITAVA_PADRAO);
  });
});

describe("midi e frequência", () => {
  it("Dó central é o 60 e o Lá central é o 69", () => {
    expect(midiDe(0, 4)).toBe(60);
    expect(midiDe(9, 4)).toBe(69);
    expect(midiDe(3, 4)).toBe(63); // Mi♭4
    expect(midiDe(0, 2)).toBe(36);
  });

  it("o lá central dá a afinação de referência, e cada oitava dobra a frequência", () => {
    expect(frequenciaDe(69)).toBe(440);
    expect(frequenciaDe(81)).toBeCloseTo(880, 9);
    expect(frequenciaDe(57)).toBeCloseTo(220, 9);
    expect(frequenciaDe(69, 442)).toBe(442);
    expect(LA_PADRAO).toBe(440);
  });

  it("valores de referência do temperamento igual", () => {
    expect(frequenciaDe(60)).toBeCloseTo(261.6256, 3); // Dó central
    expect(frequenciaDe(63)).toBeCloseTo(311.1270, 3); // Mi♭4 (o 311 Hz do esboço)
    expect(frequenciaDe(21)).toBeCloseTo(27.5, 9); // Lá0
    expect(frequenciaDe(108)).toBeCloseTo(4186.009, 2); // Dó8
  });
});

describe("cents", () => {
  it("um semitom são 100 cents e uma oitava, 1200", () => {
    expect(centsEntre(880, 440)).toBeCloseTo(1200, 9);
    expect(centsEntre(220, 440)).toBeCloseTo(-1200, 9);
    expect(centsEntre(frequenciaDe(70), frequenciaDe(69))).toBeCloseTo(100, 9);
    expect(centsEntre(440, 440)).toBe(0);
  });

  it("uma frequência ligeiramente acima ou abaixo dá cents com o sinal certo", () => {
    expect(centsEntre(440 * 2 ** (20 / 1200), 440)).toBeCloseTo(20, 9);
    expect(centsEntre(440 * 2 ** (-15 / 1200), 440)).toBeCloseTo(-15, 9);
  });
});

describe("nota mais próxima", () => {
  it("o lá exato dá Lá4 com 0 cent", () => {
    const n = notaMaisProxima(440)!;
    expect(n.midi).toBe(69);
    expect(n.classe).toBe(9);
    expect(n.oitava).toBe(4);
    expect(n.cents).toBeCloseTo(0, 9);
  });

  it("20 cents acima e abaixo de um lá", () => {
    const alta = notaMaisProxima(440 * 2 ** (20 / 1200))!;
    expect(alta.midi).toBe(69);
    expect(alta.cents).toBeCloseTo(20, 6);
    const baixa = notaMaisProxima(440 * 2 ** (-20 / 1200))!;
    expect(baixa.midi).toBe(69);
    expect(baixa.cents).toBeCloseTo(-20, 6);
  });

  it("passando de 50 cents a nota mais próxima é a vizinha, e os cents voltam a ser pequenos e do outro sinal", () => {
    const n = notaMaisProxima(440 * 2 ** (60 / 1200))!; // 60 cents acima do lá é 40 abaixo do si♭
    expect(n.midi).toBe(70);
    expect(n.classe).toBe(10);
    expect(n.cents).toBeCloseTo(-40, 6);
  });

  it("Mi♭4 e Dó central (oitava e classe)", () => {
    const mib = notaMaisProxima(frequenciaDe(63))!;
    expect([mib.classe, mib.oitava]).toEqual([3, 4]);
    const dó = notaMaisProxima(261.6256)!;
    expect([dó.classe, dó.oitava]).toEqual([0, 4]);
  });

  it("com outra afinação de referência", () => {
    const n = notaMaisProxima(442, 442)!;
    expect(n.midi).toBe(69);
    expect(n.cents).toBeCloseTo(0, 9);
  });

  it("frequência inválida não dá nota", () => {
    for (const ruim of [0, -5, NaN, Infinity]) expect(notaMaisProxima(ruim), String(ruim)).toBeNull();
  });

  it("afinação de referência inválida (zero, negativa, não finita) também não dá nota", () => {
    for (const ruim of [0, -440, NaN, Infinity, -Infinity]) expect(notaMaisProxima(440, ruim), String(ruim)).toBeNull();
  });
});

import { nomeDaNota as nome, nomeDaNotaPorExtenso as extenso, nomeDaTonalidade, sistemaDe } from "../src/lib/notacao";

describe("nomes das notas em sílabas ou letras", () => {
  it("automático segue o idioma; sílabas e letras forçam o sistema", () => {
    expect(sistemaDe("auto", "pt")).toBe("pt");
    expect(sistemaDe("auto", "en")).toBe("en");
    expect(sistemaDe("silabas", "en")).toBe("pt");
    expect(sistemaDe("silabas", "es")).toBe("es");
    expect(sistemaDe("letras", "pt")).toBe("en");
    expect(nome(10, "pt")).toBe("Si♭");
    expect(nome(10, "pt", "letras")).toBe("B♭");
    expect(nome(10, "en", "silabas")).toBe("Si♭");
    expect(nome(0, "es", "silabas")).toBe("Do");
    expect(nome(1, "pt", "letras")).toBe("C♯");
  });
  it("por extenso diz bemol ou flat na língua da interface, também com letras", () => {
    expect(extenso(10, "pt", "letras")).toBe("B bemol");
    expect(extenso(10, "en", "silabas")).toBe("Si flat");
    expect(extenso(6, "es")).toBe("Fa sostenido");
  });
  it("a tonalidade do hinário muda de sistema sem trocar a grafia (Ré♭ não vira Dó♯) e traduz maior e menor", () => {
    expect(nomeDaTonalidade("Si♭ maior", "pt", "auto")).toBe("Si♭ maior");
    expect(nomeDaTonalidade("Si♭ maior", "pt", "letras")).toBe("B♭ maior");
    expect(nomeDaTonalidade("Ré♭ maior", "pt", "letras")).toBe("D♭ maior");
    expect(nomeDaTonalidade("Mi♭ maior", "en", "auto")).toBe("E♭ major");
    expect(nomeDaTonalidade("Mi♭ maior", "es", "auto")).toBe("Mi♭ mayor");
    expect(nomeDaTonalidade("Sol maior", "en", "silabas")).toBe("Sol major");
    expect(nomeDaTonalidade("Sib maior", "pt", "letras")).toBe("B♭ maior"); // "b" digitado vale como bemol
    expect(nomeDaTonalidade("Fá# menor", "pt", "letras")).toBe("F♯ menor");
    expect(nomeDaTonalidade("tonalidade livre", "pt", "letras")).toBe("tonalidade livre"); // o que não se reconhece volta como veio
    expect(nomeDaTonalidade("Re\u0301♭ maior".replace("Re\u0301", "Ré".normalize("NFD")), "pt", "letras")).toBe("D♭ maior"); // "Ré" decomposto (NFD) também vale
  });
});

describe("Qual nota é essa? (I-35): contas do medidor de vizinhas", () => {
  const f = (midi: number, cents = 0) => frequenciaDe(midi) * 2 ** (cents / 1200);

  it("a vizinha de baixo e a de cima, um semitom", () => {
    expect(vizinhas(69)).toEqual({ abaixo: 68, acima: 70 });
  });

  it("sem nota atual vale a mais próxima, com cents com sinal", () => {
    const l = leituraComHisterese(f(69, 14), null)!;
    expect(l.midi).toBe(69);
    expect(l.cents).toBeCloseTo(14, 6);
    expect(leituraComHisterese(f(69, -30), null)!.cents).toBeCloseTo(-30, 6);
  });

  it("histerese: a nota só muda depois de passar de 60 cents; a 55 continua a mesma, com a bola presa na ponta", () => {
    const aos55 = leituraComHisterese(f(69, 55), 69)!;
    expect(aos55.midi).toBe(69);
    expect(aos55.cents).toBeCloseTo(55, 6);
    expect(posicaoNaTrilha(aos55.cents)).toBe(1);
    const aos65 = leituraComHisterese(f(69, 65), 69)!;
    expect(aos65.midi).toBe(70); // virou a vizinha de cima, com −35 cents dela
    expect(aos65.cents).toBeCloseTo(-35, 6);
  });

  it("o nome não pisca na fronteira: a 49 e a 51 cents da nota atual vale sempre a atual", () => {
    for (const c of [49, 51, -49, -51]) expect(leituraComHisterese(f(60, c), 60)!.midi).toBe(60);
  });

  it("posição na trilha vai de −1 a 1 e prende nas pontas", () => {
    expect(posicaoNaTrilha(0)).toBe(0);
    expect(posicaoNaTrilha(25)).toBe(0.5);
    expect(posicaoNaTrilha(-25)).toBe(-0.5);
    expect(posicaoNaTrilha(80)).toBe(1);
    expect(posicaoNaTrilha(-80)).toBe(-1);
  });

  it("palavra: afinado até ±5 cents, depois baixo ou alto", () => {
    expect(palavraDeAfinacao(0)).toBe("afinado");
    expect(palavraDeAfinacao(5)).toBe("afinado");
    expect(palavraDeAfinacao(-5)).toBe("afinado");
    expect(palavraDeAfinacao(5.1)).toBe("alto");
    expect(palavraDeAfinacao(-5.1)).toBe("baixo");
  });

  it("nota escrita dos instrumentos que transpõem (com a oitava)", () => {
    // trompete em Si♭ lê Ré quando soa Dó; sax alto em Mi♭ lê Lá quando soa Dó; trompa em Fá lê Sol quando soa Dó
    expect(notaEscrita(60, "concerto")).toBe(60);
    expect(notaEscrita(60, "si_bemol")).toBe(62);
    expect(notaEscrita(60, "mi_bemol")).toBe(69);
    expect(notaEscrita(60, "fa")).toBe(67);
    expect(notaEscrita(70, "si_bemol")).toBe(72); // passa de oitava: Si♭4 que soa vira Dó5 escrito
  });

  it("mediana da janela (vibrato e ruído)", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([440, 441, 900, 439, 440])).toBe(440); // um pico isolado não pesa
  });

  it("frequência inválida não dá leitura", () => {
    expect(leituraComHisterese(0, null)).toBeNull();
    expect(leituraComHisterese(NaN, 69)).toBeNull();
  });
});
