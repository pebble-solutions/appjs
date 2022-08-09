/**
 * Retourne une erreur concernant une structure indisponible
 * @param {Integer} structureId 
 */
export function StructureUnavailableError(structureId) {
    this.name = 'StructureUnavailableError';
    this.structureId = structureId;
    this.message = `La structure demandée (${structureId}) n'est pas chargée. Il est possible que vous ne disposiez pas des droits suffisants.`;
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

/**
 * Erreur retournée lorsque aucune licence n'a été retournée pour l'utilisateur connecté
 */
export function LicenceNotFoundError() {
    this.name = 'LicenceNotFound';
    this.message = "Vous ne disposez d'aucune licence active pour cette application. Contactez le service commercial.";
}

/**
 * Absence de serveur d'API sur une licence (clé licence.db non définit)
 * @param {Object} licence          Licence ayant générée l'erreur
 */
export function LicenceServerUndefinedError(licence) {
    this.name = 'LicenceServerUndefinedError';
    this.licence = licence;
    this.message = `Serveur API non défini pour la licence ${licence._id}.`;
}