export class Licence {

    constructor(options) {
        this.hydrate(options);
    }

    /**
     * Injecte les données sur l'objet
     * 
     * @param {object} data Données à injecter sur l'objet
     */
    hydrate(data) {
        this.id = data.id;
        this.apps = data.apps;
        this.db = data.db;
        this.tls = data.tls;
        this.description = data.description;
        this.name = data.name;
        this.roles = data.roles;
        this.type = data.type;
        this.users = data.users;
        this.date_start = data.date_start;
        this.date_end = data.date_end;
        this.pasIdToken = data.pasIdToken;
        this._id = data.id;
    }

    /**
     * Retourne le nom de la licence ou son ID à défaut
     * 
     * @returns {string}
     */
    get computedName() {
        return this.name ? this.name : this._id;
    }

    /**
     * Retourne l'URL de base de l'API par rapport aux informations contenues dans la licence
     * 
     * @returns {string}
     */
    get apiBaseURL() {
        let baseURL = 'http';
        baseURL += this.tls ? 's' : '';
        baseURL += '://'+this.db+'/api/';
        return baseURL;
    }
}