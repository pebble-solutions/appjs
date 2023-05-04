import App from "./app"
import CONFIG from "@/config.json"
import { AssetsController } from "./controllers/AssetsController";

export default {
    install(app) {
        app.config.globalProperties.$app = new App(CONFIG);
        app.config.globalProperties.$assets = new AssetsController();
    }
}