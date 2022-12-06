import jwt_decode from 'jwt-decode';

export class ApiIdToken {

    constructor(options) {
        options = options ?? {};
        this.hydrate(options);
    }

    /**
     * Injecte les données passés en paramètre sur l'objet
     * 
     * @param {object} data Données à injecter
     */
    hydrate(data) {
        this.db = data.db;
        this.type = data.type;
        this.login = data.login;
        this.structures = data.structures;
        this.local_uid = data.local_uid;
        this.firebase_uid = data.firebase_uid;
        this.iat = data.iat;
        this.exp = data.exp;
        this.token = data.token;
    }

    /**
     * Décode un token et hydrate l'objet
     * 
     * @param {string} token Le token à décoder
     */
    decodeToken(token) {
        let data = jwt_decode(token);

        data.structures = data.structures.split(',');
        this.hydrate(data);
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