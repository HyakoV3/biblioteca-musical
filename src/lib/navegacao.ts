import { afterNavigate, goto } from "$app/navigation";

/**
 * Devolve a função "voltar" da tela. Se a pessoa chegou por navegação dentro do app, volta no
 * histórico (a lista reaparece como estava); se a tela foi aberta direto (ex.: app restaurado),
 * vai para a Biblioteca. Chamar durante a inicialização do componente.
 */
export function usarVoltar() {
  let veioDeDentro = false;
  afterNavigate((n) => {
    veioDeDentro = n.from !== null;
  });
  return () => (veioDeDentro ? history.back() : goto("/", { replaceState: true }));
}
