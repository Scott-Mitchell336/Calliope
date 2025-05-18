const request = require('supertest');

/**
 * Creates a wrapped version of supertest that automatically closes connections
 * This helps prevent the TCPWRAP open handle issue in Jest
 */
function createSupertest(app) {
  const originalRequest = request(app);
  
  // Wrap all HTTP methods to ensure connections are properly closed
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head'];
  
  const wrappedRequest = {};
  
  methods.forEach(method => {
    wrappedRequest[method] = function(url) {
      const test = originalRequest[method](url);
      
      // Store the original end method
      const originalEnd = test.end;
      
      // Override the end method to ensure connections are closed
      test.end = function(callback) {
        originalEnd.call(test, (err, res) => {
          if (test.req && test.req.connection) {
            try {
              test.req.connection.destroy();
            } catch (e) {
              console.error('Error destroying connection:', e);
            }
          }
          
          if (callback) {
            callback(err, res);
          }
        });
        
        return this;
      };
      
      return test;
    };
  });
  
  return wrappedRequest;
}

module.exports = createSupertest;
