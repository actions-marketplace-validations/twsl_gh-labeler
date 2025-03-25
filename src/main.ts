import * as core from "@actions/core";
import App from "@/app";
import ConfigValidator from "./validators/config";

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
	try {
		// const ms: string = core.getInput("milliseconds");

		async function getConfig() {
			const input = Object.fromEntries(
				ConfigValidator.schemaKeys.map(key => [key, core.getInput(key)])
			);
			return await ConfigValidator.validate(input);
		}

		const config = await getConfig();
		const app = new App(config);
		await app.performActions();

		// Set outputs for other workflow steps to use
		// core.setOutput("time", new Date().toTimeString());
	} catch (error) {
		// Fail the workflow run if an error occurs
		if (error instanceof Error) core.setFailed(error.message);
	}
}
