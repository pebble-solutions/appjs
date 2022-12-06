/**
 * Retourne une erreur de configuration du contrôleur d'API
 * 
 * @param {string} key
 */
export class BadConfigurationException {
    constructor(key) {
        this.name = 'BadConfigurationException';
        this.key = key;
        this.message = `Erreur de configuration du controleur d'API : informations manquantes ou incomplètes pour la clé [${key}].`;
    }
}

/**
 * Retourne une erreur d'authentification. Cette erreur se produit en cas de tentatives 
 * d'authentifications multiples et infructueuses.
 */
export class UnableToReauthenticateException {
    constructor() {
        this.name = 'UnableToReauthenticateException';
        this.message = `Votre sessions est expirée, nous avons tenté de vous reconnecter sans succès.`;
    }
}

/**
 * Aucune structure disponible sur le local user
 */
export class NoStructureException {
    constructor() {
        this.name = 'NoStructureException';
        this.message = `Vous ne disposez d'aucune structure attaché à votre compte. Aucune donnée n'est accessible.`;
    }
}

/**
 * Structure non disponible sur le local user
 * 
 * @param {number} structureId
 */
export class StructureNotFoundException {
    constructor(structureId) {
        this.name = 'StructureNotFoundException';
        this.structureId = structureId;
        this.message = `La structure demandée (${structureId}) n'est pas accessible pour votre compte.`;
    }
}