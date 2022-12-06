import { ApiIdToken } from "./ApiIdToken";

export class LocalUser {

    constructor(options) {
        options = typeof options === 'undefined' ? {} : options;

        this.token = options.token;
        this.login = options.login;
        this.structures = options.structures;
    }

    /**
     * Récupère les informations depuis le Session Storage du navigateur
     */
    fromSessionStorage() {
        let local_user = sessionStorage.getItem('local_user');

        if (local_user) {
            local_user = JSON.parse(local_user);

            this.login = local_user.login;
            this.token = local_user.token;
            this.structures = local_user.structures;
        }
    }

    /**
     * Passe l'objet dans le session storage pour le faire persister.
     */
    toSessionStorage() {
        sessionStorage.setItem('local_user', JSON.stringify(this));
    }

    /**
     * Vide la session du session storage. Supprime le token d'accès afin que isAuthenticated soit false.
     */
    clearSession() {
        sessionStorage.removeItem('local_user');
        this.token = null;
    }

    /**
     * Retourne true si l'authentification de l'utilisateur est toujours valide.
     * 
     * @returns {boolean}
     */
    get isAuthenticated() {
        if (this.token) {
            let apiIdToken = new ApiIdToken();
            apiIdToken.decodeToken(this.token.jwt);
            return apiIdToken.isValid;
        }
        return false;
    }
}