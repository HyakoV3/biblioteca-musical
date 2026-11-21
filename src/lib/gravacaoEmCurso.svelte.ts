// A gravação em curso, visível de fora da aba Gravador. Com o serviço do Android assumindo a gravação, ela SEGUE ao trocar de aba (para gravar com o metrônomo no fone, I-20):
// o Gravador escreve aqui o estado, e a tela inicial mostra o aviso "● Gravando 0:34 · Parar" nas outras abas. Fora do Gravador ninguém grava, só lê e manda parar.
export const emCurso = $state<{ gravando: boolean; decorrido: number; parar: (() => void) | null; perdida: "falhou" | "incerta" | null }>({ gravando: false, decorrido: 0, parar: null, perdida: null });
// `perdida`: "falhou" = a gravação em curso não pôde ser guardada ao sair da tela inicial; "incerta" = o armazenamento demorou demais e não se sabe se ela foi guardada (some se a escrita terminar) (a tela do Gravador já se foi). Vive aqui, fora do componente, para a tela inicial mostrar o aviso
// quando a pessoa voltar a ela; some ao começar outra gravação.
