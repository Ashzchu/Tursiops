import { z } from 'zod';

export const AgentResponseSchema = z.object({
  updatedFile: z.string().min(1, 'updatedFile must not be empty'),
  summary: z.string(),
  decisions: z.array(z.string()),
  warnings: z.array(z.string()),
  testsToRun: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
