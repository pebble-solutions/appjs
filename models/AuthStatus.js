export class AuthStatus {

    constructor() {
        this.http_status = null;
        this.message = null;
        this.isAuthenticated = null;
    }

    /**
     * Injecte les informations depuis une réponse du serveur
     * 
     * @param {object} resp Réponse renvoyée par le serveur
     */
    fromResponse(resp) {
        this.http_status = resp.status;
        this.message = resp?.data?.message;
        this.isAuthenticated = resp?.data?.status == 'OK' ? true : false;
    }

    /**
     * Injecte les informations depuis une erreur du serveur
     * 
     * @param {object} error Erreur renvoyée par le serveur
     */
    fromError(error) {
        this.http_status = error.status;
        this.message = error?.response?.data?.message;
        this.isAuthenticated = false;
    }

}