import { jest } from "bun:test";

export const validate = jest.fn();

export const mockSchema = {
	validate,
};
