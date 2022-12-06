export class PasServer {

    constructor(options) {
        options = options ?? {};

        this.authServer = options.authServer;
        this.tls = options.tls;
    }

    /**
     * Retourne l'URL du serveur
     * 
     * @returns {string}
     */
    get url() {
        const http = this.tls ? "https://" : "http://";
        return http+this.authServer;
    }
}