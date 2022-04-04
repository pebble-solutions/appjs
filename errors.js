/**
 * Retourne une erreur concernant une structure indisponible
 * @param {Integer} structureId 
 */
export function StructureUnavailableError(structureId) {
    this.name = 'StructureUnavailableError';
    this.structureId = structureId;
    this.message = "La structure demandée n'est pas chargée. Il est possible que vous ne disposiez pas des droits suffisants.";
}


/**
 * Retourne une erreur concernant un fournisseur de service non disponible dans l'application
 * @param {String} authProvider Le nom du fournisseur de service (ex : google)
 */
export function AuthProviderUnreferencedError(authProvider) {
    this.name = 'AuthProviderUnreferencedError';
    this.provide = authProvider;
    this.message = `Le fournisseur de service ${authProvider} n'est pas référencé.`;
}