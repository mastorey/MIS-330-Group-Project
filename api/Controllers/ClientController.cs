using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace MyApp.Namespace
{
    [Route("api/client")]
    [ApiController]
    public class ClientController : ControllerBase
    {
        private readonly DatabaseUtility _dbUtility;

        public ClientController(DatabaseUtility dbUtility)
        {
            _dbUtility = dbUtility;
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
                
                // Get ClientID from email
                int clientId = GetClientIdFromEmail(connection, email);
                if (clientId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Client not found"
                    });
                }

                // Query sessions with related data
                string query = @"
                    SELECT 
                        sb.SessionID,
                        sb.SessionDate,
                        sb.StartTime,
                        CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
                        s.SpecialtyName,
                        sb.Status,
                        r.RoomName,
                        sb.Price,
                        COALESCE(p.Status, 'Pending') AS PaymentStatus,
                        sb.BookingDate
                    FROM SessionBooking sb
                    INNER JOIN Trainers t ON sb.TrainerID = t.TrainerID
                    INNER JOIN Users u ON t.TrainerID = u.UserID
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    LEFT JOIN Rooms r ON sb.RoomID = r.RoomID
                    LEFT JOIN Payments p ON sb.SessionID = p.SessionID AND p.IsDeleted = 0
                    WHERE sb.ClientID = @clientId 
                    AND sb.IsDeleted = 0
                    AND sb.Status != 'Cancelled'
                    ORDER BY sb.SessionDate ASC, sb.StartTime ASC";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@clientId", clientId);

                using var reader = command.ExecuteReader();
                var sessionsList = new List<object>();

                while (reader.Read())
                {
                    var session = new
                    {
                        sessionId = reader.GetInt32("SessionID"),
                        sessionDate = reader.GetDateTime("SessionDate").ToString("yyyy-MM-dd"),
                        startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm"),
                        trainerName = reader.GetString("TrainerName"),
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

        [HttpPost("payment")]
        public IActionResult ProcessPayment([FromBody] PaymentRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (request.SessionId <= 0 || request.Amount <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "SessionId and Amount are required"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Get ClientID from email
                int clientId = GetClientIdFromEmail(connection, email);
                if (clientId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Client not found"
                    });
                }

                // Verify session belongs to client
                string verifyQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE SessionID = @sessionId 
                    AND ClientID = @clientId 
                    AND IsDeleted = 0";

                using var verifyCommand = new MySqlCommand(verifyQuery, connection);
                verifyCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                verifyCommand.Parameters.AddWithValue("@clientId", clientId);
                
                var sessionExists = Convert.ToInt32(verifyCommand.ExecuteScalar()) > 0;
                if (!sessionExists)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Session not found or does not belong to this client"
                    });
                }

                // Check if payment already exists
                string checkPaymentQuery = @"
                    SELECT PaymentID, Status 
                    FROM Payments 
                    WHERE SessionID = @sessionId 
                    AND ClientID = @clientId 
                    AND IsDeleted = 0 
                    LIMIT 1";

                using var checkCommand = new MySqlCommand(checkPaymentQuery, connection);
                checkCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                checkCommand.Parameters.AddWithValue("@clientId", clientId);
                
                using var checkReader = checkCommand.ExecuteReader();
                int paymentId = 0;
                string existingStatus = null;
                
                if (checkReader.Read())
                {
                    paymentId = checkReader.GetInt32("PaymentID");
                    existingStatus = checkReader.GetString("Status");
                }
                checkReader.Close();

                if (existingStatus == "Completed")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Payment has already been completed"
                    });
                }

                // Update or insert payment
                if (paymentId > 0)
                {
                    // Update existing payment
                    string updateQuery = @"
                        UPDATE Payments 
                        SET Amount = @amount, 
                            Status = 'Completed', 
                            TransactionDate = NOW()
                        WHERE PaymentID = @paymentId";

                    using var updateCommand = new MySqlCommand(updateQuery, connection);
                    updateCommand.Parameters.AddWithValue("@amount", request.Amount);
                    updateCommand.Parameters.AddWithValue("@paymentId", paymentId);
                    
                    updateCommand.ExecuteNonQuery();
                }
                else
                {
                    // Insert new payment
                    string insertQuery = @"
                        INSERT INTO Payments (ClientID, SessionID, Amount, Status, TransactionDate)
                        VALUES (@clientId, @sessionId, @amount, 'Completed', NOW())";

                    using var insertCommand = new MySqlCommand(insertQuery, connection);
                    insertCommand.Parameters.AddWithValue("@clientId", clientId);
                    insertCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                    insertCommand.Parameters.AddWithValue("@amount", request.Amount);
                    
                    insertCommand.ExecuteNonQuery();
                }

                return Ok(new
                {
                    success = true,
                    message = "Payment processed successfully"
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
                    message = "An error occurred while processing payment",
                    error = ex.Message
                });
            }
        }

        [HttpGet("available-sessions")]
        public IActionResult GetAvailableSessions([FromQuery] string email, [FromQuery] string? sortBy = null)
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
                
                // Calculate date range for next week (7-14 days from today)
                DateTime today = DateTime.Today;
                DateTime minDate = today.AddDays(7);
                DateTime maxDate = today.AddDays(14);

                // Query available trainer availability slots
                string query = @"
                    SELECT 
                        ta.AvailabilityID,
                        ta.TrainerID,
                        CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
                        ta.SpecialtyID,
                        s.SpecialtyName,
                        ta.DayOfWeek,
                        ta.StartTime,
                        COALESCE(t.Rate, 90.00) AS Rate
                    FROM TrainerAvailability ta
                    INNER JOIN Trainers t ON ta.TrainerID = t.TrainerID
                    INNER JOIN Users u ON t.TrainerID = u.UserID
                    INNER JOIN Specialties s ON ta.SpecialtyID = s.SpecialtyID
                    WHERE ta.IsBooked = 0 
                    AND ta.IsDeleted = 0
                    AND t.IsDeleted = 0
                    AND u.IsDeleted = 0
                    AND s.IsDeleted = 0";

                // Add sorting
                string orderBy = "ta.DayOfWeek ASC, ta.StartTime ASC";
                if (!string.IsNullOrEmpty(sortBy))
                {
                    switch (sortBy.ToLower())
                    {
                        case "specialty":
                            orderBy = "s.SpecialtyName ASC, ta.DayOfWeek ASC, ta.StartTime ASC";
                            break;
                        case "time":
                            orderBy = "ta.StartTime ASC, ta.DayOfWeek ASC";
                            break;
                        case "day":
                            orderBy = "FIELD(ta.DayOfWeek, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') ASC, ta.StartTime ASC";
                            break;
                        case "trainer":
                            orderBy = "u.LastName ASC, u.FirstName ASC, ta.DayOfWeek ASC, ta.StartTime ASC";
                            break;
                    }
                }

                query += $" ORDER BY {orderBy}";

                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                var availabilityList = new List<object>();

                while (reader.Read())
                {
                    var availabilityId = reader.GetInt32("AvailabilityID");
                    var dayOfWeek = reader.GetString("DayOfWeek");
                    var startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm");
                    
                    // Calculate the actual date for next week
                    DateTime calculatedDate = CalculateNextWeekDate(today, dayOfWeek, minDate, maxDate);
                    
                    if (calculatedDate != DateTime.MinValue)
                    {
                        var rate = reader.IsDBNull(reader.GetOrdinal("Rate")) ? 90.00m : reader.GetDecimal(reader.GetOrdinal("Rate"));
                        availabilityList.Add(new
                        {
                            availabilityId = availabilityId,
                            trainerId = reader.GetInt32("TrainerID"),
                            trainerName = reader.GetString("TrainerName"),
                            specialtyId = reader.GetInt32("SpecialtyID"),
                            specialtyName = reader.GetString("SpecialtyName"),
                            dayOfWeek = dayOfWeek,
                            startTime = startTime,
                            calculatedDate = calculatedDate.ToString("yyyy-MM-dd"),
                            rate = rate
                        });
                    }
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
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching available sessions",
                    error = ex.Message
                });
            }
        }

        [HttpPost("book-session")]
        public IActionResult BookSession([FromBody] BookSessionRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (request.AvailabilityId <= 0 || string.IsNullOrEmpty(request.CalculatedDate))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "AvailabilityId and CalculatedDate are required"
                });
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Get ClientID from email
                int clientId = GetClientIdFromEmail(connection, email);
                if (clientId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Client not found"
                    });
                }

                // Verify availability exists and is not booked
                string checkAvailabilityQuery = @"
                    SELECT ta.TrainerID, ta.SpecialtyID, ta.StartTime
                    FROM TrainerAvailability ta
                    WHERE ta.AvailabilityID = @availabilityId 
                    AND ta.IsBooked = 0 
                    AND ta.IsDeleted = 0
                    LIMIT 1";

                using var checkCommand = new MySqlCommand(checkAvailabilityQuery, connection);
                checkCommand.Parameters.AddWithValue("@availabilityId", request.AvailabilityId);
                
                using var checkReader = checkCommand.ExecuteReader();
                if (!checkReader.Read())
                {
                    // Check if availability exists but is booked
                    checkReader.Close();
                    string checkBookedQuery = @"
                        SELECT IsBooked 
                        FROM TrainerAvailability 
                        WHERE AvailabilityID = @availabilityId 
                        AND IsDeleted = 0";
                    
                    using var bookedCommand = new MySqlCommand(checkBookedQuery, connection);
                    bookedCommand.Parameters.AddWithValue("@availabilityId", request.AvailabilityId);
                    var bookedResult = bookedCommand.ExecuteScalar();
                    
                    if (bookedResult != null && Convert.ToBoolean(bookedResult))
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "This time slot has already been booked by another client. Please select a different time."
                        });
                    }
                    
                    return BadRequest(new
                    {
                        success = false,
                        message = "This availability slot is no longer available. Please select a different time."
                    });
                }

                int trainerId = checkReader.GetInt32("TrainerID");
                int specialtyId = checkReader.GetInt32("SpecialtyID");
                TimeSpan startTime = checkReader.GetTimeSpan("StartTime");
                checkReader.Close();

                // Get trainer's rate from Trainers table
                decimal price = 0.00m; // Default price
                string getRateQuery = "SELECT Rate FROM Trainers WHERE TrainerID = @trainerId AND IsDeleted = 0";
                using (var rateCommand = new MySqlCommand(getRateQuery, connection))
                {
                    rateCommand.Parameters.AddWithValue("@trainerId", trainerId);
                    var rateResult = rateCommand.ExecuteScalar();
                    if (rateResult != null && rateResult != DBNull.Value)
                    {
                        price = Convert.ToDecimal(rateResult);
                    }
                }

                // Parse calculated date
                if (!DateTime.TryParse(request.CalculatedDate, out DateTime sessionDate))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Invalid date format"
                    });
                }

                // Verify date is within next week range (7-14 days)
                DateTime today = DateTime.Today;
                DateTime minDate = today.AddDays(7);
                DateTime maxDate = today.AddDays(14);
                
                if (sessionDate < minDate || sessionDate > maxDate)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Session date must be between 7 and 14 days from today"
                    });
                }

                // Create session booking
                string insertSessionQuery = @"
                    INSERT INTO SessionBooking (TrainerID, ClientID, SpecialtyID, SessionDate, StartTime, Status, Price)
                    VALUES (@trainerId, @clientId, @specialtyId, @sessionDate, @startTime, 'Pending', @price)";

                using var sessionCommand = new MySqlCommand(insertSessionQuery, connection);
                sessionCommand.Parameters.AddWithValue("@trainerId", trainerId);
                sessionCommand.Parameters.AddWithValue("@clientId", clientId);
                sessionCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                sessionCommand.Parameters.AddWithValue("@sessionDate", sessionDate);
                sessionCommand.Parameters.AddWithValue("@startTime", startTime);
                sessionCommand.Parameters.AddWithValue("@price", price);
                
                sessionCommand.ExecuteNonQuery();
                int sessionId = (int)sessionCommand.LastInsertedId;

                // Mark availability as booked
                string updateAvailabilityQuery = @"
                    UPDATE TrainerAvailability 
                    SET IsBooked = 1 
                    WHERE AvailabilityID = @availabilityId";

                using var updateCommand = new MySqlCommand(updateAvailabilityQuery, connection);
                updateCommand.Parameters.AddWithValue("@availabilityId", request.AvailabilityId);
                updateCommand.ExecuteNonQuery();

                // Create payment record with Pending status
                string insertPaymentQuery = @"
                    INSERT INTO Payments (ClientID, SessionID, Amount, Status)
                    VALUES (@clientId, @sessionId, @price, 'Pending')";

                using var paymentCommand = new MySqlCommand(insertPaymentQuery, connection);
                paymentCommand.Parameters.AddWithValue("@clientId", clientId);
                paymentCommand.Parameters.AddWithValue("@sessionId", sessionId);
                paymentCommand.Parameters.AddWithValue("@price", price);
                paymentCommand.ExecuteNonQuery();

                return Ok(new
                {
                    success = true,
                    message = "Session booked successfully",
                    sessionId = sessionId
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
                    message = "An error occurred while booking session",
                    error = ex.Message
                });
            }
        }

        [HttpPut("sessions/{id}/cancel")]
        public IActionResult CancelSession(int id, [FromQuery] string email)
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
                
                // Get ClientID from email
                int clientId = GetClientIdFromEmail(connection, email);
                if (clientId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Client not found"
                    });
                }

                // Verify session belongs to client and is not already cancelled/completed
                string checkSessionQuery = @"
                    SELECT SessionID, TrainerID, SpecialtyID, SessionDate, StartTime, Status
                    FROM SessionBooking 
                    WHERE SessionID = @sessionId 
                    AND ClientID = @clientId 
                    AND IsDeleted = 0";

                using var checkCommand = new MySqlCommand(checkSessionQuery, connection);
                checkCommand.Parameters.AddWithValue("@sessionId", id);
                checkCommand.Parameters.AddWithValue("@clientId", clientId);

                using var checkReader = checkCommand.ExecuteReader();
                if (!checkReader.Read())
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Session not found or does not belong to this client"
                    });
                }

                string currentStatus = checkReader.GetString("Status");
                int trainerId = checkReader.GetInt32("TrainerID");
                int specialtyId = checkReader.GetInt32("SpecialtyID");
                DateTime sessionDate = checkReader.GetDateTime("SessionDate");
                TimeSpan startTime = checkReader.GetTimeSpan("StartTime");
                checkReader.Close();

                // Check if session can be cancelled
                if (currentStatus == "Cancelled")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Session is already cancelled"
                    });
                }

                if (currentStatus == "Completed")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cannot cancel a completed session"
                    });
                }

                // Update session status to Cancelled
                string updateSessionQuery = @"
                    UPDATE SessionBooking 
                    SET Status = 'Cancelled', IsCancelled = 1 
                    WHERE SessionID = @sessionId";

                using var updateSessionCommand = new MySqlCommand(updateSessionQuery, connection);
                updateSessionCommand.Parameters.AddWithValue("@sessionId", id);
                updateSessionCommand.ExecuteNonQuery();

                // Get day of week from session date (convert enum to string format used in DB)
                Dictionary<DayOfWeek, string> dayMap = new Dictionary<DayOfWeek, string>
                {
                    { DayOfWeek.Monday, "Monday" },
                    { DayOfWeek.Tuesday, "Tuesday" },
                    { DayOfWeek.Wednesday, "Wednesday" },
                    { DayOfWeek.Thursday, "Thursday" },
                    { DayOfWeek.Friday, "Friday" },
                    { DayOfWeek.Saturday, "Saturday" },
                    { DayOfWeek.Sunday, "Sunday" }
                };
                string dayOfWeek = dayMap[sessionDate.DayOfWeek];
                
                // Find and free up the TrainerAvailability slot
                string findAvailabilityQuery = @"
                    SELECT AvailabilityID 
                    FROM TrainerAvailability 
                    WHERE TrainerID = @trainerId 
                    AND SpecialtyID = @specialtyId 
                    AND DayOfWeek = @dayOfWeek 
                    AND StartTime = @startTime 
                    AND IsDeleted = 0
                    LIMIT 1";

                using var findAvailCommand = new MySqlCommand(findAvailabilityQuery, connection);
                findAvailCommand.Parameters.AddWithValue("@trainerId", trainerId);
                findAvailCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                findAvailCommand.Parameters.AddWithValue("@dayOfWeek", dayOfWeek);
                findAvailCommand.Parameters.AddWithValue("@startTime", startTime);

                var availabilityIdResult = findAvailCommand.ExecuteScalar();
                if (availabilityIdResult != null)
                {
                    int availabilityId = Convert.ToInt32(availabilityIdResult);
                    
                    // Free up the availability slot
                    string freeAvailabilityQuery = @"
                        UPDATE TrainerAvailability 
                        SET IsBooked = 0 
                        WHERE AvailabilityID = @availabilityId";

                    using var freeAvailCommand = new MySqlCommand(freeAvailabilityQuery, connection);
                    freeAvailCommand.Parameters.AddWithValue("@availabilityId", availabilityId);
                    freeAvailCommand.ExecuteNonQuery();
                }

                // Update payment status to Failed if payment was completed (for refund tracking)
                string updatePaymentQuery = @"
                    UPDATE Payments 
                    SET Status = 'Failed' 
                    WHERE SessionID = @sessionId 
                    AND Status = 'Completed'";

                using var updatePaymentCommand = new MySqlCommand(updatePaymentQuery, connection);
                updatePaymentCommand.Parameters.AddWithValue("@sessionId", id);
                updatePaymentCommand.ExecuteNonQuery();

                return Ok(new
                {
                    success = true,
                    message = "Session cancelled successfully"
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
                    message = "An error occurred while cancelling session",
                    error = ex.Message
                });
            }
        }

        // Helper method to calculate next week date
        private DateTime CalculateNextWeekDate(DateTime today, string dayOfWeek, DateTime minDate, DateTime maxDate)
        {
            // Map day names to DayOfWeek enum
            Dictionary<string, DayOfWeek> dayMap = new Dictionary<string, DayOfWeek>
            {
                { "Monday", DayOfWeek.Monday },
                { "Tuesday", DayOfWeek.Tuesday },
                { "Wednesday", DayOfWeek.Wednesday },
                { "Thursday", DayOfWeek.Thursday },
                { "Friday", DayOfWeek.Friday },
                { "Saturday", DayOfWeek.Saturday },
                { "Sunday", DayOfWeek.Sunday }
            };

            if (!dayMap.ContainsKey(dayOfWeek))
            {
                return DateTime.MinValue;
            }

            DayOfWeek targetDay = dayMap[dayOfWeek];
            
            // Find the next occurrence of this day within the range
            DateTime currentDate = minDate;
            while (currentDate <= maxDate)
            {
                if (currentDate.DayOfWeek == targetDay)
                {
                    return currentDate;
                }
                currentDate = currentDate.AddDays(1);
            }

            return DateTime.MinValue;
        }

        // Helper method
        private int GetClientIdFromEmail(MySqlConnection connection, string email)
        {
            string query = @"
                SELECT c.ClientID 
                FROM Clients c
                INNER JOIN Users u ON c.ClientID = u.UserID
                WHERE u.Email = @email 
                AND u.UserType = 'Client'
                AND u.IsDeleted = 0
                AND c.IsDeleted = 0";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@email", email.ToLower().Trim());
            
            var result = command.ExecuteScalar();
            return result != null ? Convert.ToInt32(result) : 0;
        }
    }

    public class PaymentRequest
    {
        public int SessionId { get; set; }
        public decimal Amount { get; set; }
        public string CardNumber { get; set; } = string.Empty;
        public string CardHolderName { get; set; } = string.Empty;
        public int ExpiryMonth { get; set; }
        public int ExpiryYear { get; set; }
        public string Cvv { get; set; } = string.Empty;
    }

    public class BookSessionRequest
    {
        public int AvailabilityId { get; set; }
        public string CalculatedDate { get; set; } = string.Empty;
    }
}

