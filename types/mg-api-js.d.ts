declare module "mg-api-js" {
  export class API {
    constructor(
      userName: string,
      password: string,
      database: string,
      server?: string
    );
    authenticate(): Promise<void>;
    call(method: string, params?: Record<string, any>): Promise<any>;
  }
}
