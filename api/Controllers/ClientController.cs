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
                
                // Get ClientID from email to check for free session reward
                int clientId = GetClientIdFromEmail(connection, email);
                
                // Check if client exists
                if (clientId == 0)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Client account not found. Please ensure you are logged in as a Client and your account exists."
                    });
                }
                
                bool hasFreeSession = false;
                
                if (clientId > 0)
                {
                    // Check if client has a free session reward available (count Pending, Confirmed, and Completed)
                    int completedSessions = 0;
                    string completedQuery = @"
                        SELECT COUNT(*) 
                        FROM SessionBooking 
                        WHERE ClientID = @clientId 
                        AND (Status = 'Completed' OR Status = 'Pending' OR Status = 'Confirmed')
                        AND IsDeleted = 0";
                    using (var completedCommand = new MySqlCommand(completedQuery, connection))
                    {
                        completedCommand.Parameters.AddWithValue("@clientId", clientId);
                        completedSessions = Convert.ToInt32(completedCommand.ExecuteScalar());
                    }

                    int freeSessionsUsed = 0;
                    string freeQuery = @"
                        SELECT COUNT(*) 
                        FROM SessionBooking 
                        WHERE ClientID = @clientId 
                        AND Price = 0.00 
                        AND IsDeleted = 0";
                    using (var freeCommand = new MySqlCommand(freeQuery, connection))
                    {
                        freeCommand.Parameters.AddWithValue("@clientId", clientId);
                        freeSessionsUsed = Convert.ToInt32(freeCommand.ExecuteScalar());
                    }

                    int cyclesCompleted = completedSessions / 10;
                    int rewardsAvailable = cyclesCompleted - freeSessionsUsed;
                    hasFreeSession = rewardsAvailable > 0;
                }
                
                // Calculate date range for next week (7-14 days from today)
                DateTime today = DateTime.Today;
                DateTime minDate = today.AddDays(7);
                DateTime maxDate = today.AddDays(14);

                // Query available trainer availability slots
                // Note: IsBooked column doesn't exist in database, so we show all non-deleted availability slots
                // The booking process will check for conflicts when a client tries to book
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
                    WHERE ta.IsDeleted = 0
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
                        // If client has a free session reward, set rate to $0
                        if (hasFreeSession)
                        {
                            rate = 0.00m;
                        }
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
                    message = $"Database error occurred: {ex.Message}",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"An error occurred while fetching available sessions: {ex.Message}",
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

                // Verify availability exists
                string checkAvailabilityQuery = @"
                    SELECT ta.TrainerID, ta.SpecialtyID, ta.StartTime, ta.DayOfWeek
                    FROM TrainerAvailability ta
                    WHERE ta.AvailabilityID = @availabilityId 
                    AND ta.IsDeleted = 0
                    LIMIT 1";

                using var checkCommand = new MySqlCommand(checkAvailabilityQuery, connection);
                checkCommand.Parameters.AddWithValue("@availabilityId", request.AvailabilityId);
                
                using var checkReader = checkCommand.ExecuteReader();
                if (!checkReader.Read())
                {
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

                // Check if client has a free session reward available
                bool useFreeSession = false;
                if (request.UseFreeSession == true)
                {
                    // Verify client has a free session available (count both Pending and Completed)
                    int completedSessions = 0;
                    string completedQuery = @"
                        SELECT COUNT(*) 
                        FROM SessionBooking 
                        WHERE ClientID = @clientId 
                        AND (Status = 'Completed' OR Status = 'Pending' OR Status = 'Confirmed')
                        AND IsDeleted = 0";
                    using (var completedCommand = new MySqlCommand(completedQuery, connection))
                    {
                        completedCommand.Parameters.AddWithValue("@clientId", clientId);
                        completedSessions = Convert.ToInt32(completedCommand.ExecuteScalar());
                    }

                    int freeSessionsUsed = 0;
                    string freeQuery = @"
                        SELECT COUNT(*) 
                        FROM SessionBooking 
                        WHERE ClientID = @clientId 
                        AND Price = 0.00 
                        AND IsDeleted = 0";
                    using (var freeCommand = new MySqlCommand(freeQuery, connection))
                    {
                        freeCommand.Parameters.AddWithValue("@clientId", clientId);
                        freeSessionsUsed = Convert.ToInt32(freeCommand.ExecuteScalar());
                    }

                    int cyclesCompleted = completedSessions / 10;
                    int rewardsAvailable = cyclesCompleted - freeSessionsUsed;

                    if (rewardsAvailable > 0)
                    {
                        useFreeSession = true;
                        price = 0.00m; // Set price to $0 for free session
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

                // Create session booking - For demo purposes, mark as Completed immediately
                string insertSessionQuery = @"
                    INSERT INTO SessionBooking (TrainerID, ClientID, SpecialtyID, SessionDate, StartTime, Status, Price)
                    VALUES (@trainerId, @clientId, @specialtyId, @sessionDate, @startTime, 'Completed', @price)";

                using var sessionCommand = new MySqlCommand(insertSessionQuery, connection);
                sessionCommand.Parameters.AddWithValue("@trainerId", trainerId);
                sessionCommand.Parameters.AddWithValue("@clientId", clientId);
                sessionCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                sessionCommand.Parameters.AddWithValue("@sessionDate", sessionDate);
                sessionCommand.Parameters.AddWithValue("@startTime", startTime);
                sessionCommand.Parameters.AddWithValue("@price", price);
                
                sessionCommand.ExecuteNonQuery();
                int sessionId = (int)sessionCommand.LastInsertedId;

                // Note: IsBooked column doesn't exist in database
                // Booking status is tracked via SessionBooking table instead

                // Create payment record - For demo purposes, mark as Completed immediately if price > 0
                // If free session (price = 0), still create payment record but mark as Completed
                string insertPaymentQuery = @"
                    INSERT INTO Payments (ClientID, SessionID, Amount, Status)
                    VALUES (@clientId, @sessionId, @price, 'Completed')";

                using var paymentCommand = new MySqlCommand(insertPaymentQuery, connection);
                paymentCommand.Parameters.AddWithValue("@clientId", clientId);
                paymentCommand.Parameters.AddWithValue("@sessionId", sessionId);
                paymentCommand.Parameters.AddWithValue("@price", price);
                paymentCommand.ExecuteNonQuery();

                // Verify the session was created and get count (Pending, Confirmed, and Completed all count)
                string verifyQuery = @"
                    SELECT Status, SessionID,
                           (SELECT COUNT(*) FROM SessionBooking WHERE ClientID = @clientId AND (Status = 'Completed' OR Status = 'Pending' OR Status = 'Confirmed') AND IsDeleted = 0) AS TotalSessions
                    FROM SessionBooking 
                    WHERE SessionID = @sessionId 
                    AND ClientID = @clientId 
                    AND IsDeleted = 0";
                
                using var verifyCommand = new MySqlCommand(verifyQuery, connection);
                verifyCommand.Parameters.AddWithValue("@sessionId", sessionId);
                verifyCommand.Parameters.AddWithValue("@clientId", clientId);
                
                using var verifyReader = verifyCommand.ExecuteReader();
                string actualStatus = "Unknown";
                int totalSessions = 0;
                if (verifyReader.Read())
                {
                    actualStatus = verifyReader.GetString("Status");
                    totalSessions = verifyReader.GetInt32("TotalSessions");
                }
                verifyReader.Close();

                Console.WriteLine($"[Booking] Session {sessionId} created with Status: {actualStatus}, Total Sessions (Pending + Completed): {totalSessions}");
                
                // Double-check by querying all sessions (Pending, Confirmed, and Completed) for this client
                string doubleCheckQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE ClientID = @clientId 
                    AND (Status = 'Completed' OR Status = 'Pending' OR Status = 'Confirmed')
                    AND IsDeleted = 0";
                
                using var doubleCheckCommand = new MySqlCommand(doubleCheckQuery, connection);
                doubleCheckCommand.Parameters.AddWithValue("@clientId", clientId);
                var doubleCheckResult = doubleCheckCommand.ExecuteScalar();
                int doubleCheckCount = doubleCheckResult != null && doubleCheckResult != DBNull.Value 
                    ? Convert.ToInt32(doubleCheckResult) 
                    : 0;
                
                Console.WriteLine($"[Booking] Double-check: Total sessions (Pending + Completed) in DB: {doubleCheckCount}");

                return Ok(new
                {
                    success = true,
                    message = "Session booked successfully",
                    sessionId = sessionId,
                    status = actualStatus,
                    totalCompleted = totalSessions
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
                    
                    // Note: IsBooked column doesn't exist in database
                    // Availability is freed when session is cancelled (tracked via SessionBooking table)
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

        [HttpGet("tracker")]
        public IActionResult GetTrackerData([FromQuery] string email)
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

                // Get all-time sessions count (both Pending and Completed count towards tracker)
                // Use a fresh query to ensure we get the latest data
                
                // First, check total sessions (for debugging)
                string totalSessionsQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE ClientID = @clientId 
                    AND IsDeleted = 0";
                
                using var totalCommand = new MySqlCommand(totalSessionsQuery, connection);
                totalCommand.Parameters.AddWithValue("@clientId", clientId);
                var totalResult = totalCommand.ExecuteScalar();
                int totalSessions = totalResult != null && totalResult != DBNull.Value 
                    ? Convert.ToInt32(totalResult) 
                    : 0;
                
                // Check sessions by status (for debugging)
                string statusBreakdownQuery = @"
                    SELECT Status, COUNT(*) AS Count
                    FROM SessionBooking 
                    WHERE ClientID = @clientId 
                    AND IsDeleted = 0
                    GROUP BY Status";
                
                using var statusCommand = new MySqlCommand(statusBreakdownQuery, connection);
                statusCommand.Parameters.AddWithValue("@clientId", clientId);
                using var statusReader = statusCommand.ExecuteReader();
                var statusBreakdown = new Dictionary<string, int>();
                while (statusReader.Read())
                {
                    string status = statusReader.GetString("Status");
                    int count = statusReader.GetInt32("Count");
                    statusBreakdown[status] = count;
                }
                statusReader.Close();
                
                Console.WriteLine($"[Tracker] Client {clientId} - Total sessions (all statuses): {totalSessions}");
                foreach (var kvp in statusBreakdown)
                {
                    Console.WriteLine($"[Tracker]   - {kvp.Key}: {kvp.Value}");
                }
                
                string completedSessionsQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE ClientID = @clientId 
                    AND (Status = 'Completed' OR Status = 'Pending' OR Status = 'Confirmed')
                    AND IsDeleted = 0";

                using var completedCommand = new MySqlCommand(completedSessionsQuery, connection);
                completedCommand.Parameters.AddWithValue("@clientId", clientId);
                var completedResult = completedCommand.ExecuteScalar();
                int allTimeCompleted = completedResult != null && completedResult != DBNull.Value 
                    ? Convert.ToInt32(completedResult) 
                    : 0;

                Console.WriteLine($"[Tracker] Client {clientId} - All-time sessions (Pending + Confirmed + Completed): {allTimeCompleted}");

                // Calculate 1-10 counter (current cycle)
                int currentCycleCount = allTimeCompleted % 10;
                int cyclesCompleted = allTimeCompleted / 10;
                
                Console.WriteLine($"[Tracker] Current cycle count: {currentCycleCount}, Cycles completed: {cyclesCompleted}");

                // Calculate rewards earned and used
                // Rewards earned = cyclesCompleted
                // Rewards used = count of sessions with Price = 0 that were booked after earning a reward
                string freeSessionsQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE ClientID = @clientId 
                    AND Price = 0.00 
                    AND IsDeleted = 0";

                using var freeCommand = new MySqlCommand(freeSessionsQuery, connection);
                freeCommand.Parameters.AddWithValue("@clientId", clientId);
                int freeSessionsUsed = Convert.ToInt32(freeCommand.ExecuteScalar());

                // Calculate available rewards
                int rewardsAvailable = cyclesCompleted - freeSessionsUsed;
                bool hasFreeSession = rewardsAvailable > 0;

                // Get total calories burned from sessions (Pending, Confirmed, and Completed all count)
                string caloriesQuery = @"
                    SELECT 
                        s.SpecialtyName,
                        COUNT(*) AS SessionCount
                    FROM SessionBooking sb
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    WHERE sb.ClientID = @clientId 
                    AND (sb.Status = 'Completed' OR sb.Status = 'Pending' OR sb.Status = 'Confirmed')
                    AND sb.IsDeleted = 0
                    AND s.IsDeleted = 0
                    GROUP BY s.SpecialtyID, s.SpecialtyName";

                using var caloriesCommand = new MySqlCommand(caloriesQuery, connection);
                caloriesCommand.Parameters.AddWithValue("@clientId", clientId);
                
                using var caloriesReader = caloriesCommand.ExecuteReader();
                int totalCalories = 0;
                
                while (caloriesReader.Read())
                {
                    string specialtyName = caloriesReader.GetString("SpecialtyName");
                    int sessionCount = caloriesReader.GetInt32("SessionCount");
                    int caloriesPerSession = GetCaloriesPerSession(specialtyName);
                    totalCalories += caloriesPerSession * sessionCount;
                }
                caloriesReader.Close();

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        allTimeCompleted = allTimeCompleted,
                        currentCycleCount = currentCycleCount,
                        cyclesCompleted = cyclesCompleted,
                        rewardsAvailable = rewardsAvailable,
                        hasFreeSession = hasFreeSession,
                        totalCalories = totalCalories
                    }
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
                    message = "An error occurred while fetching tracker data",
                    error = ex.Message
                });
            }
        }

        // Helper method to get calories per session based on specialty
        private int GetCaloriesPerSession(string specialtyName)
        {
            // Calorie mapping for different specialties (calories burned per 1-hour session)
            var calorieMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                { "Cardio", 600 },
                { "Strength Training", 400 },
                { "Yoga", 250 },
                { "Pilates", 300 },
                { "HIIT", 700 },
                { "CrossFit", 650 },
                { "Swimming", 550 },
                { "Cycling", 500 },
                { "Running", 600 },
                { "Boxing", 650 },
                { "Dance", 450 },
                { "Stretching", 150 },
                { "Weightlifting", 350 },
                { "Functional Training", 500 },
                { "Personal Training", 450 }
            };

            // Return calories for specialty, or default to 400 if not found
            return calorieMap.TryGetValue(specialtyName, out int calories) ? calories : 400;
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
        public bool? UseFreeSession { get; set; }
    }
}

