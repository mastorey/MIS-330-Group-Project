using MySql.Data.MySqlClient;
using System.Data;

namespace MyApp.Namespace
{
    public class DatabaseUtility
    {
        private readonly string _connectionString;

        public DatabaseUtility(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found in appsettings.json");
        }

        public MySqlConnection GetConnection()
        {
            try
            {
                var connection = new MySqlConnection(_connectionString);
                connection.Open();
                Console.WriteLine("Database connection established successfully.");
                return connection;
            }
            catch (MySqlException ex)
            {
                Console.WriteLine($"MySQL Error: {ex.Message}");
                Console.WriteLine($"Error Code: {ex.Number}");
                throw;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Connection Error: {ex.Message}");
                throw;
            }
        }
    }
}

