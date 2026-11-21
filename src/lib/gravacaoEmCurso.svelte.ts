// A gravação em curso, visível de fora da aba Gravador. Com o serviço do Android assumindo a gravação, ela SEGUE ao trocar de aba (para gravar com o metrônomo no fone, I-20):
// o Gravador escreve aqui o estado, e a tela inicial mostra o aviso "● Gravando 0:34 · Parar" nas outras abas. Fora do Gravador ninguém grava, só lê e manda parar.
export const emCurso = $state<{ gravando: boolean; decorrido: number; parar: (() => void) | null }>({ gravando: false, decorrido: 0, parar: null });
