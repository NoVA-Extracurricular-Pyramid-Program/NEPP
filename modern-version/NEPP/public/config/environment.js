const environments = {
  development: {
    apiKey: "dev-key",
    // other dev config
  },
  production: {
    apiKey: "AIzaSyACpzHEJBx9xBI0vWijY4BdgYug1CY4DBY",
    // current production config
  }
};

export const currentEnvironment = window.location.hostname === 'localhost' 
  ? environments.development 
  : environments.production;