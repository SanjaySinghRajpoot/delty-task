export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required`);
  }
};

export const validateString = (value: any, fieldName: string, minLength?: number): void => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (minLength && value.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters long`);
  }
};

