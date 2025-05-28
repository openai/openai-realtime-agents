import { conversationMachine } from '@/app/simple/machines/conversationMachine';

describe('conversationMachine', () => {
  test('benefit and value from greeting jumps to loan simulation', () => {
    let state = conversationMachine.initialState;
    state = conversationMachine.transition(state, { type: 'BENEFIT_AND_VALUE_PROVIDED' });
    expect(state.value).toBe('6_loan_simulation');
  });

  test('name leads to identify_need', () => {
    let state = conversationMachine.initialState;
    state = conversationMachine.transition(state, { type: 'NAME_DETECTED' });
    expect(state.value).toBe('2_identify_need');
  });

  test('benefit confirmed without camera goes to camera verification', () => {
    let state = {
      value: '4_benefit_verification',
      context: { cameraVerified: false }
    } as any;
    state = conversationMachine.transition(state, { type: 'BENEFIT_CONFIRMED' });
    expect(state.value).toBe('5_camera_verification');
  });

  test('camera verification completes flow', () => {
    let state = {
      value: '5_camera_verification',
      context: { cameraVerified: false }
    } as any;
    state = conversationMachine.transition(state, { type: 'CAMERA_VERIFIED' });
    expect(state.value).toBe('6_loan_simulation');
    expect(state.context.cameraVerified).toBe(true);
  });
});
