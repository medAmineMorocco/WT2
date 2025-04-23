export default class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
