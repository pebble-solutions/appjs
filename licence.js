export default class Licence {

    constructor(licence) {
        for (const key in licence) {
            this[key] = licence[key];
        }

        if (!this._id) {
            this._id = this.id;
        }
    }

    /**
     * Retourne le nom de la licence ou son ID à défaut
     * @returns {String}
     */
    getComputedName() {
        return this.name ? this.name : this._id;
    }
}