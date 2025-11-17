using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace MyApp.Namespace
{
    [Route("api/db")]
    [ApiController]
    public class DatabaseController : ControllerBase
    {
        private readonly DatabaseUtility _dbUtility;

        public DatabaseController(DatabaseUtility dbUtility)
        {
            _dbUtility = dbUtility;
        }

        [HttpGet("test")]
        public IActionResult TestConnection()
        {
            try
            {
                using var connection = _dbUtility.GetConnection();
                using var command = new MySqlCommand("SELECT 1", connection);
                var result = command.ExecuteScalar();

                return Ok(new
                {
                    success = true,
                    message = "Database connection successful",
                    result = result?.ToString(),
                    timestamp = DateTime.UtcNow
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database connection failed",
                    error = ex.Message,
                    errorCode = ex.Number,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Connection error",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }
    }
}

