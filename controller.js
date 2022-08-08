import App from "./app"
import CONFIG from "@/config.json"

export default {
    install(app) {
        app.config.globalProperties.$app = new App(CONFIG);
    }
}