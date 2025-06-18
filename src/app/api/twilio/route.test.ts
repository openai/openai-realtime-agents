import { POST } from './route'; // Adjust the import path as needed
import { NextRequest } from 'next/server';
import { twiml } from 'twilio';
const { MessagingResponse } = twiml;

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      post: jest.fn().mockResolvedValue({ id: 'session_mock_id' }),
    };
  });
});

describe('POST /api/twilio', () => {
  const mockPhoneNumber = '+1234567890';
  const mockMessageBody = 'Hello, agent!';

  const createMockRequest = (formDataBody: Record<string, string> | null, throwsError = false) => {
    const formData = new FormData();
    if (formDataBody) {
      for (const key in formDataBody) {
        formData.append(key, formDataBody[key]);
      }
    }

    return {
      formData: jest.fn().mockImplementation(async () => {
        if (throwsError) {
          throw new Error('Failed to parse FormData');
        }
        return formData;
      }),
      // Add other NextRequest properties if your handler uses them
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    (require('openai') as jest.Mock).mockClear();
    // Clear mock calls for formData if needed, or re-mock inside tests for specific formData behavior
  });

  it('should handle a valid Twilio SMS, create an OpenAI session, and return TwiML response', async () => {
    const mockRequest = createMockRequest({
      From: mockPhoneNumber,
      Body: mockMessageBody,
    });

    const response = await POST(mockRequest);
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/xml');

    // Check for TwiML response structure and placeholder message
    const expectedTwiML = new MessagingResponse();
    expectedTwiML.message('Agent response placeholder'); // This was the placeholder
    expect(responseText).toBe(expectedTwiML.toString());

    // Verify OpenAI client was called
    const OpenAI = require('openai');
    const openaiInstance = new OpenAI();
    expect(openaiInstance.post).toHaveBeenCalledWith('/realtime/sessions', {
      body: {
        agent_id: "agent_id_placeholder",
        user_id: mockPhoneNumber,
        voice: null,
        language: "en",
        output_format: {
          encoding: "text",
          container: "none"
        },
        model_parameters: {
          temperature: 0.7
        }
      }
    });
  });

  it('should return a 500 error with TwiML message if request processing fails', async () => {
    const mockRequest = createMockRequest(null, true); // Simulate formData() throwing an error

    const response = await POST(mockRequest);
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('text/xml');

    const expectedErrorTwiML = new MessagingResponse();
    expectedErrorTwiML.message('Sorry, something went wrong. Please try again later.');
    expect(responseText).toBe(expectedErrorTwiML.toString());
  });

  // Add more tests for other scenarios, e.g., missing From/Body, OpenAI API errors, etc.
});
