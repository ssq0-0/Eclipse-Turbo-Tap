import axios from "axios";
import { LoggerService } from "../logger/logger";

interface VersionInfo {
    tag_name: string;
    html_url: string;
}

const repo = {
    LinkRepo: "https://api.github.com/repos/ssq0-0/Eclipse-AIO/releases/latest",
    SoftVersion: "v0.1.0", 
};

export async function checkVersion(logger: LoggerService): Promise<void> {
    try {
        const response = await axios.get<VersionInfo>(repo.LinkRepo);
        const version = response.data;

        if (repo.SoftVersion !== version.tag_name) {
            logger.warn(`Your version (${repo.SoftVersion}) is outdated. Latest version is ${version.tag_name}`);
            logger.warn(`Read about the changes here: ${version.html_url}`);
        } else {
            logger.info("You are using the latest version.");
        }
    } catch (error) {
        logger.error("Error checking version:");
        throw error;
    }
}
