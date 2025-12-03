using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace MyApp.Namespace
{
    [Route("api/trainer")]
    [ApiController]
    public class TrainerController : ControllerBase
    {
        private readonly DatabaseUtility _dbUtility;

        public TrainerController(DatabaseUtility dbUtility)
        {
            _dbUtility = dbUtility;
        }

        [HttpGet("availability")]
        public IActionResult GetAvailability([FromQuery] string email)
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
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Query availability with specialty names and booking status
                string query = @"
                    SELECT 
                        ta.AvailabilityID,
                        ta.DayOfWeek,
                        ta.StartTime,
                        ta.SpecialtyID,
                        s.SpecialtyName,
                        CASE 
                            WHEN EXISTS (
                                SELECT 1 
                                FROM SessionBooking sb 
                                WHERE sb.AvailabilityID = ta.AvailabilityID 
                                AND sb.Status != 'Cancelled'
                                AND sb.IsDeleted = 0
                            ) THEN 1 
                            ELSE 0 
                        END AS IsBooked
                    FROM TrainerAvailability ta
                    INNER JOIN Specialties s ON ta.SpecialtyID = s.SpecialtyID
                    WHERE ta.TrainerID = @trainerId 
                    AND ta.IsDeleted = 0
                    AND s.IsDeleted = 0
                    ORDER BY 
                        FIELD(ta.DayOfWeek, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                        ta.StartTime";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@trainerId", trainerId);

                using var reader = command.ExecuteReader();
                var availabilityList = new List<object>();

                int availabilityIdOrdinal = reader.GetOrdinal("AvailabilityID");
                int dayOfWeekOrdinal = reader.GetOrdinal("DayOfWeek");
                int startTimeOrdinal = reader.GetOrdinal("StartTime");
                int specialtyIdOrdinal = reader.GetOrdinal("SpecialtyID");
                int specialtyNameOrdinal = reader.GetOrdinal("SpecialtyName");
                int isBookedOrdinal = reader.GetOrdinal("IsBooked");

                while (reader.Read())
                {
                    var availability = new
                    {
                        availabilityId = reader.IsDBNull(availabilityIdOrdinal) ? 0 : reader.GetInt32(availabilityIdOrdinal),
                        dayOfWeek = reader.IsDBNull(dayOfWeekOrdinal) ? string.Empty : reader.GetString(dayOfWeekOrdinal),
                        startTime = reader.IsDBNull(startTimeOrdinal) ? string.Empty : reader.GetTimeSpan(startTimeOrdinal).ToString(@"hh\:mm"),
                        specialtyId = reader.IsDBNull(specialtyIdOrdinal) ? 0 : reader.GetInt32(specialtyIdOrdinal),
                        specialtyName = reader.IsDBNull(specialtyNameOrdinal) ? string.Empty : reader.GetString(specialtyNameOrdinal),
                        isBooked = reader.IsDBNull(isBookedOrdinal) ? false : reader.GetInt32(isBookedOrdinal) == 1
                    };
                    availabilityList.Add(availability);
                }

                return Ok(new
                {
                    success = true,
                    data = availabilityList
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching availability"
                });
            }
        }

        [HttpGet("all-specialties")]
        public IActionResult GetAllSpecialties()
        {
            try
            {
                using var connection = _dbUtility.GetConnection();
                
                string query = @"
                    SELECT 
                        SpecialtyID,
                        SpecialtyName
                    FROM Specialties
                    WHERE IsDeleted = 0
                    ORDER BY SpecialtyName";

                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                var specialtiesList = new List<object>();

                while (reader.Read())
                {
                    var specialty = new
                    {
                        specialtyId = reader.GetInt32("SpecialtyID"),
                        specialtyName = reader.GetString("SpecialtyName")
                    };
                    specialtiesList.Add(specialty);
                }

                return Ok(new
                {
                    success = true,
                    data = specialtiesList
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
                    message = "An error occurred while fetching specialties",
                    error = ex.Message
                });
            }
        }

        [HttpGet("specialties")]
        public IActionResult GetSpecialties([FromQuery] string email)
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
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Query trainer specialties
                string query = @"
                    SELECT 
                        ts.SpecialtyID,
                        s.SpecialtyName
                    FROM TrainerSpecialties ts
                    INNER JOIN Specialties s ON ts.SpecialtyID = s.SpecialtyID
                    WHERE ts.TrainerID = @trainerId 
                    AND ts.IsDeleted = 0
                    AND s.IsDeleted = 0
                    ORDER BY s.SpecialtyName";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@trainerId", trainerId);

                using var reader = command.ExecuteReader();
                var specialtiesList = new List<object>();

                while (reader.Read())
                {
                    var specialty = new
                    {
                        specialtyId = reader.GetInt32("SpecialtyID"),
                        specialtyName = reader.GetString("SpecialtyName")
                    };
                    specialtiesList.Add(specialty);
                }

                return Ok(new
                {
                    success = true,
                    data = specialtiesList
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
                    message = "An error occurred while fetching specialties",
                    error = ex.Message
                });
            }
        }

        [HttpPut("specialties")]
        public IActionResult UpdateSpecialties([FromBody] SpecialtiesUpdateRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (request.SpecialtyIds == null || request.SpecialtyIds.Count == 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "At least one specialty must be selected"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Validate all specialty IDs exist and are not deleted
                foreach (int specialtyId in request.SpecialtyIds)
                {
                    using var checkCommand = new MySqlCommand("SELECT COUNT(*) FROM Specialties WHERE SpecialtyID = @specialtyId AND IsDeleted = 0", connection);
                    checkCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                    int count = Convert.ToInt32(checkCommand.ExecuteScalar());
                    
                    if (count == 0)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = $"Specialty ID {specialtyId} does not exist or is deleted"
                        });
                    }
                }

                // Soft delete all existing trainer specialties
                using var deleteCommand = new MySqlCommand(
                    "UPDATE TrainerSpecialties SET IsDeleted = 1 WHERE TrainerID = @trainerId", 
                    connection);
                deleteCommand.Parameters.AddWithValue("@trainerId", trainerId);
                deleteCommand.ExecuteNonQuery();

                // Insert new specialties
                foreach (int specialtyId in request.SpecialtyIds)
                {
                    // Check if specialty already exists (soft deleted)
                    using var checkExistingCommand = new MySqlCommand(
                        "SELECT COUNT(*) FROM TrainerSpecialties WHERE TrainerID = @trainerId AND SpecialtyID = @specialtyId",
                        connection);
                    checkExistingCommand.Parameters.AddWithValue("@trainerId", trainerId);
                    checkExistingCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                    int existingCount = Convert.ToInt32(checkExistingCommand.ExecuteScalar());

                    if (existingCount > 0)
                    {
                        // Restore soft deleted specialty
                        using var restoreCommand = new MySqlCommand(
                            "UPDATE TrainerSpecialties SET IsDeleted = 0 WHERE TrainerID = @trainerId AND SpecialtyID = @specialtyId",
                            connection);
                        restoreCommand.Parameters.AddWithValue("@trainerId", trainerId);
                        restoreCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                        restoreCommand.ExecuteNonQuery();
                    }
                    else
                    {
                        // Insert new specialty
                        using var insertCommand = new MySqlCommand(
                            "INSERT INTO TrainerSpecialties (TrainerID, SpecialtyID, IsDeleted, CreatedAt) VALUES (@trainerId, @specialtyId, 0, NOW())",
                            connection);
                        insertCommand.Parameters.AddWithValue("@trainerId", trainerId);
                        insertCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                        insertCommand.ExecuteNonQuery();
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = "Specialties updated successfully"
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
                    message = "An error occurred while updating specialties",
                    error = ex.Message
                });
            }
        }

        [HttpPost("availability")]
        public IActionResult AddAvailability([FromBody] AvailabilityRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (string.IsNullOrEmpty(request.DayOfWeek) || string.IsNullOrEmpty(request.StartTime) || request.SpecialtyId <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "DayOfWeek, StartTime, and SpecialtyId are required"
                });
            }

            // Validate DayOfWeek
            string[] validDays = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };
            if (!validDays.Contains(request.DayOfWeek))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Invalid DayOfWeek. Must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Check if specialty belongs to trainer
                if (!TrainerHasSpecialty(connection, trainerId, request.SpecialtyId))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Specialty does not belong to this trainer"
                    });
                }

                // Parse time
                if (!TimeSpan.TryParse(request.StartTime, out TimeSpan startTime))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Invalid StartTime format. Use HH:MM or HH:MM:SS"
                    });
                }

                // Insert availability
                string insertQuery = @"
                    INSERT INTO TrainerAvailability (TrainerID, SpecialtyID, DayOfWeek, StartTime)
                    VALUES (@trainerId, @specialtyId, @dayOfWeek, @startTime)";

                using var command = new MySqlCommand(insertQuery, connection);
                command.Parameters.AddWithValue("@trainerId", trainerId);
                command.Parameters.AddWithValue("@specialtyId", request.SpecialtyId);
                command.Parameters.AddWithValue("@dayOfWeek", request.DayOfWeek);
                command.Parameters.AddWithValue("@startTime", startTime);

                int rowsAffected = command.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to add availability"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Availability added successfully"
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
                    message = "An error occurred while adding availability",
                    error = ex.Message
                });
            }
        }

        [HttpPut("availability/{id}")]
        public IActionResult UpdateAvailability(int id, [FromBody] AvailabilityUpdateRequest request, [FromQuery] string email)
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
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Verify availability belongs to trainer
                if (!AvailabilityBelongsToTrainer(connection, id, trainerId))
                {
                    return Forbid("This availability does not belong to you");
                }

                // Check if booked
                if (IsAvailabilityBooked(connection, id))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cannot update booked availability"
                    });
                }

                // Build update query dynamically
                var updateFields = new List<string>();
                var parameters = new List<MySqlParameter>();

                if (!string.IsNullOrEmpty(request.DayOfWeek))
                {
                    string[] validDays = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };
                    if (!validDays.Contains(request.DayOfWeek))
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Invalid DayOfWeek"
                        });
                    }
                    updateFields.Add("DayOfWeek = @dayOfWeek");
                    parameters.Add(new MySqlParameter("@dayOfWeek", request.DayOfWeek));
                }

                if (!string.IsNullOrEmpty(request.StartTime))
                {
                    if (!TimeSpan.TryParse(request.StartTime, out TimeSpan startTime))
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Invalid StartTime format"
                        });
                    }
                    updateFields.Add("StartTime = @startTime");
                    parameters.Add(new MySqlParameter("@startTime", startTime));
                }

                if (request.SpecialtyId.HasValue && request.SpecialtyId.Value > 0)
                {
                    // Check if specialty belongs to trainer
                    if (!TrainerHasSpecialty(connection, trainerId, request.SpecialtyId.Value))
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Specialty does not belong to this trainer"
                        });
                    }
                    updateFields.Add("SpecialtyID = @specialtyId");
                    parameters.Add(new MySqlParameter("@specialtyId", request.SpecialtyId.Value));
                }

                if (updateFields.Count == 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "No fields to update"
                    });
                }

                string updateQuery = $"UPDATE TrainerAvailability SET {string.Join(", ", updateFields)} WHERE AvailabilityID = @availabilityId";
                using var command = new MySqlCommand(updateQuery, connection);
                command.Parameters.AddWithValue("@availabilityId", id);
                foreach (var param in parameters)
                {
                    command.Parameters.Add(param);
                }

                int rowsAffected = command.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Availability not found or no changes made"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Availability updated successfully"
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
                    message = "An error occurred while updating availability",
                    error = ex.Message
                });
            }
        }

        [HttpDelete("availability/{id}")]
        public IActionResult DeleteAvailability(int id, [FromQuery] string email)
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
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Verify availability belongs to trainer
                if (!AvailabilityBelongsToTrainer(connection, id, trainerId))
                {
                    return Forbid("This availability does not belong to you");
                }

                // Check if booked
                if (IsAvailabilityBooked(connection, id))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cannot delete booked availability"
                    });
                }

                // Soft delete
                string deleteQuery = "UPDATE TrainerAvailability SET IsDeleted = 1 WHERE AvailabilityID = @availabilityId";
                using var command = new MySqlCommand(deleteQuery, connection);
                command.Parameters.AddWithValue("@availabilityId", id);

                int rowsAffected = command.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Availability not found"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Availability deleted successfully"
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
                    message = "An error occurred while deleting availability",
                    error = ex.Message
                });
            }
        }

        // Helper methods
        private int GetTrainerIdFromEmail(MySqlConnection connection, string email)
        {
            string query = @"
                SELECT t.TrainerID 
                FROM Trainers t
                INNER JOIN Users u ON t.TrainerID = u.UserID
                WHERE u.Email = @email 
                AND u.UserType = 'Trainer'
                AND u.IsDeleted = 0
                AND t.IsDeleted = 0";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@email", email.ToLower().Trim());
            
            var result = command.ExecuteScalar();
            return result != null ? Convert.ToInt32(result) : 0;
        }

        private bool TrainerHasSpecialty(MySqlConnection connection, int trainerId, int specialtyId)
        {
            string query = @"
                SELECT COUNT(*) 
                FROM TrainerSpecialties 
                WHERE TrainerID = @trainerId 
                AND SpecialtyID = @specialtyId 
                AND IsDeleted = 0";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@trainerId", trainerId);
            command.Parameters.AddWithValue("@specialtyId", specialtyId);
            
            var count = Convert.ToInt32(command.ExecuteScalar());
            return count > 0;
        }

        private bool AvailabilityBelongsToTrainer(MySqlConnection connection, int availabilityId, int trainerId)
        {
            string query = @"
                SELECT COUNT(*) 
                FROM TrainerAvailability 
                WHERE AvailabilityID = @availabilityId 
                AND TrainerID = @trainerId 
                AND IsDeleted = 0";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@availabilityId", availabilityId);
            command.Parameters.AddWithValue("@trainerId", trainerId);
            
            var count = Convert.ToInt32(command.ExecuteScalar());
            return count > 0;
        }

        private bool IsAvailabilityBooked(MySqlConnection connection, int availabilityId)
        {
            string query = @"
                SELECT COUNT(*) 
                FROM SessionBooking 
                WHERE AvailabilityID = @availabilityId 
                AND Status != 'Cancelled'
                AND IsDeleted = 0";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@availabilityId", availabilityId);
            
            var count = Convert.ToInt32(command.ExecuteScalar());
            return count > 0;
        }

        [HttpGet("sessions")]
        public IActionResult GetSessions([FromQuery] string email)
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
                
                // Get TrainerID from email
                int trainerId = GetTrainerIdFromEmail(connection, email);
                if (trainerId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Trainer not found"
                    });
                }

                // Query sessions with related data
                // Note: We use LEFT JOIN for Clients and Users to still show bookings even if client account is deleted
                // This preserves historical booking data for trainers
                string query = @"
                    SELECT 
                        sb.SessionID,
                        sb.SessionDate,
                        sb.StartTime,
                        CASE 
                            WHEN u.IsDeleted = 1 OR c.IsDeleted = 1 THEN 
                                CONCAT(COALESCE(u.FirstName, ''), ' ', COALESCE(u.LastName, ''), ' (Account Deleted)')
                            ELSE 
                                CONCAT(u.FirstName, ' ', u.LastName)
                        END AS ClientName,
                        s.SpecialtyName,
                        sb.Status,
                        r.RoomName,
                        sb.Price,
                        COALESCE(p.Status, 'Pending') AS PaymentStatus,
                        sb.BookingDate
                    FROM SessionBooking sb
                    LEFT JOIN Clients c ON sb.ClientID = c.ClientID
                    LEFT JOIN Users u ON c.ClientID = u.UserID
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    LEFT JOIN Rooms r ON sb.RoomID = r.RoomID
                    LEFT JOIN Payments p ON sb.SessionID = p.SessionID AND p.IsDeleted = 0
                    WHERE sb.TrainerID = @trainerId 
                    AND sb.IsDeleted = 0
                    ORDER BY sb.SessionDate ASC, sb.StartTime ASC";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@trainerId", trainerId);

                using var reader = command.ExecuteReader();
                var sessionsList = new List<object>();

                while (reader.Read())
                {
                    var session = new
                    {
                        sessionId = reader.GetInt32("SessionID"),
                        sessionDate = reader.GetDateTime("SessionDate").ToString("yyyy-MM-dd"),
                        startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm"),
                        clientName = reader.GetString("ClientName"),
                        specialtyName = reader.GetString("SpecialtyName"),
                        status = reader.GetString("Status"),
                        roomName = reader.IsDBNull(reader.GetOrdinal("RoomName")) ? null : reader.GetString("RoomName"),
                        price = reader.IsDBNull(reader.GetOrdinal("Price")) ? 0.00m : reader.GetDecimal("Price"),
                        paymentStatus = reader.GetString("PaymentStatus"),
                        bookingDate = reader.IsDBNull(reader.GetOrdinal("BookingDate")) ? null : reader.GetDateTime("BookingDate").ToString("yyyy-MM-dd HH:mm:ss")
                    };
                    sessionsList.Add(session);
                }

                return Ok(new
                {
                    success = true,
                    data = sessionsList
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
                    message = "An error occurred while fetching sessions",
                    error = ex.Message
                });
            }
        }
    }

    public class AvailabilityRequest
    {
        public string DayOfWeek { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public int SpecialtyId { get; set; }
    }

    public class AvailabilityUpdateRequest
    {
        public string? DayOfWeek { get; set; }
        public string? StartTime { get; set; }
        public int? SpecialtyId { get; set; }
    }

    public class SpecialtiesUpdateRequest
    {
        public List<int> SpecialtyIds { get; set; } = new List<int>();
    }
}

