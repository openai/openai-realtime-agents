import { processUserInput, exportContext, resetConversationContext, setCameraVerified } from '@/app/agentConfigs/utils';

beforeEach(() => {
  resetConversationContext();
});

describe('processUserInput', () => {
  test('extracts entities and updates context', () => {
    const phrase = 'Meu nome é Joao. Meu benefício é 123456. Quero um empréstimo de R$ 50.000 para reforma. Estou com meu filho.';
    const result = processUserInput(phrase);

    expect(result.entities).toEqual(expect.objectContaining({
      name: 'Joao',
      benefitNumber: '123456',
      requestedAmount: 'R$ 50.000',
      purpose: 'reforma',
      hasCompanion: true,
      companionType: 'filho(a)'
    }));
    expect(result.recommendedState).toBe('6_loan_simulation');

    const context = exportContext();
    expect(context.name).toBe('Joao');
    expect(context.benefitNumber).toBe('123456');
    expect(context.requestedAmount).toBe('R$ 50.000');
    expect(context.purpose).toBe('reforma');
    expect(context.hasCompanion).toBe(true);
    expect(context.companionType).toBe('filho(a)');
    expect(context.confirmedEntities.has('benefitNumber')).toBe(true);
  });

  test('recommends loan simulation when camera is verified', () => {
    setCameraVerified(true);
    const phrase = 'Meu benefício é 654321 e quero um empréstimo de R$ 10.000';
    const result = processUserInput(phrase);
    expect(result.recommendedState).toBe('6_loan_simulation');
  });

  test('context persists across multiple inputs', () => {
    processUserInput('Meu nome é Maria');
    let context = exportContext();
    expect(context.name).toBe('Maria');
    expect(context.benefitNumber).toBeUndefined();

    processUserInput('Número do benefício 111222');
    context = exportContext();
    expect(context.name).toBe('Maria');
    expect(context.benefitNumber).toBe('111222');
  });
});
