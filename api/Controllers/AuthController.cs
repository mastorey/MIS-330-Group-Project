using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Security.Cryptography;
using System.Text;

namespace MyApp.Namespace
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly DatabaseUtility _dbUtility;

        public AuthController(DatabaseUtility dbUtility)
        {
            _dbUtility = dbUtility;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email and password are required"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Query user by email
                string query = @"
                    SELECT Email, Password, UserType, FirstName, LastName 
                    FROM Users 
                    WHERE Email = @email";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@email", request.Email.ToLower().Trim());

                using var reader = command.ExecuteReader();
                
                if (!reader.Read())
                {
                    return Unauthorized(new
                    {
                        success = false,
                        message = "Invalid email or password"
                    });
                }

                // Get stored password and user type
                string storedPassword = reader.GetString("Password");
                string userType = reader.GetString("UserType");
                string firstName = reader.IsDBNull(reader.GetOrdinal("FirstName")) ? "" : reader.GetString("FirstName");
                string lastName = reader.IsDBNull(reader.GetOrdinal("LastName")) ? "" : reader.GetString("LastName");

                // Verify password (assuming plain text for now - should be hashed in production)
                if (storedPassword != request.Password)
                {
                    return Unauthorized(new
                    {
                        success = false,
                        message = "Invalid email or password"
                    });
                }

                // Login successful
                return Ok(new
                {
                    success = true,
                    message = $"Successfully logged in as a {userType}",
                    role = userType,
                    email = request.Email,
                    firstName = firstName,
                    lastName = lastName
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred during login",
                    error = ex.Message
                });
            }
        }

        [HttpPost("signup")]
        public IActionResult Signup([FromBody] SignupRequest request)
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password) ||
                string.IsNullOrEmpty(request.FirstName) || string.IsNullOrEmpty(request.LastName) ||
                string.IsNullOrEmpty(request.Birthday) || string.IsNullOrEmpty(request.UserType))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "All required fields must be provided"
                });
            }

            // Normalize UserType to proper case (Client, Trainer, Admin)
            string normalizedUserType = request.UserType.ToLower();
            if (normalizedUserType == "client")
                normalizedUserType = "Client";
            else if (normalizedUserType == "trainer")
                normalizedUserType = "Trainer";
            else if (normalizedUserType == "admin")
                normalizedUserType = "Admin";
            else
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Invalid UserType. Must be Client, Trainer, or Admin"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Check if email already exists
                string checkQuery = "SELECT Email FROM Users WHERE Email = @email";
                bool emailExists = false;
                using (var checkCommand = new MySqlCommand(checkQuery, connection))
                {
                    checkCommand.Parameters.AddWithValue("@email", request.Email.ToLower().Trim());
                    using var checkReader = checkCommand.ExecuteReader();
                    emailExists = checkReader.Read();
                }
                
                if (emailExists)
                {
                    return Conflict(new
                    {
                        success = false,
                        message = "An account with this email already exists"
                    });
                }

                // Insert into Users table
                string insertUserQuery = @"
                    INSERT INTO Users (Email, Password, FirstName, LastName, Birthday, UserType)
                    VALUES (@email, @password, @firstName, @lastName, @birthday, @userType);
                    SELECT LAST_INSERT_ID();";

                int userId = 0;
                using (var insertUserCommand = new MySqlCommand(insertUserQuery, connection))
                {
                    insertUserCommand.Parameters.AddWithValue("@email", request.Email.ToLower().Trim());
                    insertUserCommand.Parameters.AddWithValue("@password", request.Password);
                    insertUserCommand.Parameters.AddWithValue("@firstName", request.FirstName.Trim());
                    insertUserCommand.Parameters.AddWithValue("@lastName", request.LastName.Trim());
                    insertUserCommand.Parameters.AddWithValue("@birthday", DateTime.Parse(request.Birthday));
                    insertUserCommand.Parameters.AddWithValue("@userType", normalizedUserType);

                    var result = insertUserCommand.ExecuteScalar();
                    if (result != null)
                    {
                        userId = Convert.ToInt32(result);
                    }
                }

                if (userId == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to create user account"
                    });
                }

                // Insert into appropriate child table
                string childTableQuery = "";
                if (normalizedUserType == "Client")
                {
                    childTableQuery = @"
                        INSERT INTO Clients (ClientID, JoinDate, Phone)
                        VALUES (@userId, @joinDate, @phone)";
                }
                else if (normalizedUserType == "Trainer")
                {
                    childTableQuery = @"
                        INSERT INTO Trainers (TrainerID, Phone, Rate)
                        VALUES (@userId, @phone, @rate)";
                }
                else if (normalizedUserType == "Admin")
                {
                    childTableQuery = @"
                        INSERT INTO Admins (AdminID)
                        VALUES (@userId)";
                }

                if (!string.IsNullOrEmpty(childTableQuery))
                {
                    using var insertChildCommand = new MySqlCommand(childTableQuery, connection);
                    insertChildCommand.Parameters.AddWithValue("@userId", userId);
                    
                    if (normalizedUserType == "Client")
                    {
                        insertChildCommand.Parameters.AddWithValue("@joinDate", DateTime.Now.Date);
                        insertChildCommand.Parameters.AddWithValue("@phone", request.Phone ?? (object)DBNull.Value);
                    }
                    else if (normalizedUserType == "Trainer")
                    {
                        insertChildCommand.Parameters.AddWithValue("@phone", request.Phone ?? (object)DBNull.Value);
                        decimal rateValue = request.Rate.HasValue && request.Rate.Value >= 0 ? request.Rate.Value : 0.00m;
                        insertChildCommand.Parameters.AddWithValue("@rate", rateValue);
                    }

                    int childRowsAffected = insertChildCommand.ExecuteNonQuery();

                    if (childRowsAffected == 0)
                    {
                        // Rollback: delete the user if child insert fails
                        using var deleteCommand = new MySqlCommand("DELETE FROM Users WHERE UserID = @userId", connection);
                        deleteCommand.Parameters.AddWithValue("@userId", userId);
                        deleteCommand.ExecuteNonQuery();

                        return StatusCode(500, new
                        {
                            success = false,
                            message = "Failed to create account in child table"
                        });
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = $"{normalizedUserType} account created successfully"
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred during signup",
                    error = ex.Message
                });
            }
        }

        [HttpGet("profile")]
        public IActionResult GetProfile([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Query user by email with role-specific data
                string query = @"
                    SELECT 
                        u.UserID,
                        u.Email,
                        u.FirstName,
                        u.LastName,
                        u.Birthday,
                        u.UserType,
                        CASE 
                            WHEN u.UserType = 'Client' THEN c.Phone
                            WHEN u.UserType = 'Trainer' THEN t.Phone
                            ELSE NULL
                        END AS Phone,
                        CASE 
                            WHEN u.UserType = 'Trainer' THEN t.Certification
                            ELSE NULL
                        END AS Certification,
                        CASE 
                            WHEN u.UserType = 'Trainer' THEN COALESCE(t.Rate, 90.00)
                            ELSE NULL
                        END AS Rate
                    FROM Users u
                    LEFT JOIN Clients c ON u.UserID = c.ClientID AND u.UserType = 'Client'
                    LEFT JOIN Trainers t ON u.UserID = t.TrainerID AND u.UserType = 'Trainer'
                    WHERE u.Email = @email AND u.IsDeleted = 0";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@email", email.ToLower().Trim());

                using var reader = command.ExecuteReader();
                
                if (!reader.Read())
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "User not found"
                    });
                }

                // Build response
                int birthdayOrdinal = reader.GetOrdinal("Birthday");
                int rateOrdinal = reader.GetOrdinal("Rate");
                var profile = new
                {
                    success = true,
                    email = reader.GetString("Email"),
                    firstName = reader.IsDBNull(reader.GetOrdinal("FirstName")) ? "" : reader.GetString("FirstName"),
                    lastName = reader.IsDBNull(reader.GetOrdinal("LastName")) ? "" : reader.GetString("LastName"),
                    birthday = reader.IsDBNull(birthdayOrdinal) ? "" : reader.GetDateTime(birthdayOrdinal).ToString("yyyy-MM-dd"),
                    userType = reader.GetString("UserType"),
                    phone = reader.IsDBNull(reader.GetOrdinal("Phone")) ? null : reader.GetString("Phone"),
                    certification = reader.IsDBNull(reader.GetOrdinal("Certification")) ? null : reader.GetString("Certification"),
                    rate = reader.IsDBNull(rateOrdinal) ? (decimal?)null : reader.GetDecimal(rateOrdinal)
                };

                return Ok(profile);
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching profile",
                    error = ex.Message
                });
            }
        }

        [HttpPut("profile/update")]
        public IActionResult UpdateProfile([FromBody] ProfileUpdateRequest request)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // First, get the user's UserType and UserID
                string getUserQuery = "SELECT UserID, UserType FROM Users WHERE Email = @email AND IsDeleted = 0";
                int userId = 0;
                string userType = "";
                
                using (var getUserCommand = new MySqlCommand(getUserQuery, connection))
                {
                    getUserCommand.Parameters.AddWithValue("@email", request.Email.ToLower().Trim());
                    using var getUserReader = getUserCommand.ExecuteReader();
                    
                    if (!getUserReader.Read())
                    {
                        return NotFound(new
                        {
                            success = false,
                            message = "User not found"
                        });
                    }
                    
                    userId = getUserReader.GetInt32("UserID");
                    userType = getUserReader.GetString("UserType");
                }

                // Update Users table
                string updateUserQuery = @"
                    UPDATE Users 
                    SET FirstName = @firstName,
                        LastName = @lastName,
                        Birthday = @birthday";
                
                if (!string.IsNullOrEmpty(request.Password))
                {
                    updateUserQuery += ", Password = @password";
                }
                
                updateUserQuery += " WHERE UserID = @userId";

                using var updateUserCommand = new MySqlCommand(updateUserQuery, connection);
                updateUserCommand.Parameters.AddWithValue("@firstName", request.FirstName?.Trim() ?? "");
                updateUserCommand.Parameters.AddWithValue("@lastName", request.LastName?.Trim() ?? "");
                updateUserCommand.Parameters.AddWithValue("@birthday", string.IsNullOrEmpty(request.Birthday) 
                    ? (object)DBNull.Value 
                    : DateTime.Parse(request.Birthday));
                updateUserCommand.Parameters.AddWithValue("@userId", userId);
                
                if (!string.IsNullOrEmpty(request.Password))
                {
                    updateUserCommand.Parameters.AddWithValue("@password", request.Password);
                }

                int userRowsAffected = updateUserCommand.ExecuteNonQuery();

                if (userRowsAffected == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to update user profile"
                    });
                }

                // Update role-specific tables
                if (userType == "Client" || userType == "Trainer")
                {
                    string updatePhoneQuery = "";
                    if (userType == "Client")
                    {
                        updatePhoneQuery = "UPDATE Clients SET Phone = @phone WHERE ClientID = @userId";
                    }
                    else if (userType == "Trainer")
                    {
                        updatePhoneQuery = "UPDATE Trainers SET Phone = @phone WHERE TrainerID = @userId";
                    }

                    if (!string.IsNullOrEmpty(updatePhoneQuery))
                    {
                        using var updatePhoneCommand = new MySqlCommand(updatePhoneQuery, connection);
                        updatePhoneCommand.Parameters.AddWithValue("@phone", string.IsNullOrEmpty(request.Phone) 
                            ? (object)DBNull.Value 
                            : request.Phone.Trim());
                        updatePhoneCommand.Parameters.AddWithValue("@userId", userId);
                        updatePhoneCommand.ExecuteNonQuery();
                    }
                }

                if (userType == "Trainer")
                {
                    if (request.Certification != null)
                {
                    string updateCertQuery = "UPDATE Trainers SET Certification = @certification WHERE TrainerID = @userId";
                    using var updateCertCommand = new MySqlCommand(updateCertQuery, connection);
                    updateCertCommand.Parameters.AddWithValue("@certification", string.IsNullOrEmpty(request.Certification) 
                        ? (object)DBNull.Value 
                        : request.Certification.Trim());
                    updateCertCommand.Parameters.AddWithValue("@userId", userId);
                    updateCertCommand.ExecuteNonQuery();
                    }
                    
                    if (request.Rate.HasValue)
                    {
                        string updateRateQuery = "UPDATE Trainers SET Rate = @rate WHERE TrainerID = @userId";
                        using var updateRateCommand = new MySqlCommand(updateRateQuery, connection);
                        decimal rateValue = request.Rate.Value >= 0 ? request.Rate.Value : 0.00m;
                        updateRateCommand.Parameters.AddWithValue("@rate", rateValue);
                        updateRateCommand.Parameters.AddWithValue("@userId", userId);
                        updateRateCommand.ExecuteNonQuery();
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = "Profile updated successfully"
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while updating profile",
                    error = ex.Message
                });
            }
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class SignupRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Birthday { get; set; } = string.Empty;
        public string UserType { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public decimal? Rate { get; set; }
    }

    public class ProfileUpdateRequest
    {
        public string Email { get; set; } = string.Empty;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Birthday { get; set; }
        public string? Password { get; set; }
        public string? Phone { get; set; }
        public string? Certification { get; set; }
        public decimal? Rate { get; set; }
    }
}

