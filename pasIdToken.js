import jwt_decode from 'jwt-decode';

export default class PasIdToken {

    constructor(idToken) {
        this.hydrate(idToken);
    }

    /**
     * Hydrate l'objet
     * 
     * @param {object} idToken Objet représentant la PasIdToken interface
     */
    hydrate(idToken) {
        this.token = idToken.token;
        this.sub = idToken.sub;
        this.iss = idToken.iss;
        this.type = idToken.type;
        this.db = idToken.db;
        this.login = idToken.login;
        this.name = idToken.name;
        this.iat = idToken.iat;
        this.exp = idToken.exp;
    }

    /**
     * Décode un token et hydrate l'objet
     * 
     * @param {string} token Le token à décoder
     */
    decodeToken(token) {
        this.hydrate(jwt_decode(token));
        this.token = token;
    }

    /**
     * Vérifie si le token n'a pas expiré.
     * 
     * @return {boolean}
     */
    get isValid() {
        return this.exp >= Date.now() / 1000 ? true : false;
    }

}