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
            MySqlConnection connection = new MySqlConnection(_connectionString);
            try
            {
                connection.Open();
                Console.WriteLine("Database connection established successfully.");
                return connection;
            }
            catch
            {
                connection.Dispose();
                throw;
            }
        }
    }
}



