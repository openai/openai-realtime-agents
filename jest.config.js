module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mediapipe/tasks-vision$': '<rootDir>/__mocks__/mediapipe-tasks-vision.ts'
  },
};
