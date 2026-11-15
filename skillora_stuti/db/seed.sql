-- Skillora Seed Data
-- Inserts categories matching data.js exactly, plus development sample records

USE skillora_db;

-- 1. Insert Categories
INSERT INTO categories (id, slug, name, icon, tone, display_order) VALUES
(1, 'video-editing', 'Video Editing', 'clap', 'L', 1),
(2, 'graphic-design', 'Graphic Design', 'pen', 'B', 2),
(3, 'content-writing', 'Content Writing', 'wr', 'Y', 3),
(4, 'web-development', 'Web Development', 'code', 'L', 4),
(5, 'photography', 'Photography', 'cam', 'B', 5),
(6, 'social-media', 'Social Media', 'mega', 'Y', 6),
(7, 'presentations', 'Presentations', 'pres', 'L', 7),
(8, 'coding', 'Coding Help', 'term', 'B', 8),
(9, 'ui-ux-design', 'UI/UX & App Design', 'pen', 'L', 9),
(10, 'tutoring-academics', 'Tutoring & Academics', 'cap', 'Y', 10),
(11, 'music-audio', 'Music & Audio Production', 'spark', 'B', 11),
(12, 'career-resume', 'Resume & Career Prep', 'wr', 'L', 12),
(13, 'event-coverage', 'Event & Campus Coverage', 'cam', 'Y', 13),
(14, 'ai-data-analytics', 'AI & Data Analytics', 'code', 'B', 14)
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  icon = VALUES(icon),
  tone = VALUES(tone),
  display_order = VALUES(display_order);

-- 2. Insert Test Student Producers, Consumers, and Admin
INSERT INTO users (id, email, name, department, role, avatar_url, bio) VALUES
(1, 'riya.k@bennett.edu.in', 'Riya Kapoor', 'B.Des', 'producer', '', 'UI/UX and Graphic Design student passionate about clean, modern brand assets.'),
(2, 'aarav.s@bennett.edu.in', 'Aarav Sharma', 'B.Tech CSE', 'producer', '', 'Full-stack developer building robust web apps, portfolio websites, and bots.'),
(3, 'ananya.m@bennett.edu.in', 'Ananya Mishra', 'BAJMC', 'producer', '', 'Video editor and storyteller specializing in short-form reels and YouTube edits.'),
(4, 'rohan.v@bennett.edu.in', 'Rohan Verma', 'B.Tech ECE', 'consumer', '', 'Engineering student looking for creative project services.'),
(5, 'admin@bennett.edu.in', 'Bennett Marketplace Admin', 'Bennett Administration', 'admin', '', 'Authorized operator moderating the student marketplace.')
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  department = VALUES(department),
  role = VALUES(role),
  bio = VALUES(bio);

-- 3. Insert Test Services
INSERT INTO services (id, producer_id, category_id, title, description, price, price_display, delivery_time, badge, is_sample, status) VALUES
(1, 1, 2, 'Sample service — your listing could look like this', 'This is an example, not a real service. Student services will appear here once producers publish them.', 299.00, 'Your price', '2 days', 'Example', TRUE, 'active'),
(2, 3, 1, 'Instagram Reel & YouTube Short Editing', 'Punchy cuts, sound design, auto-captions, and trending beat-matching for Instagram & TikTok.', 499.00, 'From ₹499', '24 hours', 'Available', FALSE, 'active'),
(3, 1, 2, 'Club Poster & Event Banner Design', 'High-resolution eye-catching posters for university club events, festivals, and socials.', 349.00, '₹349', '2 days', 'Popular', FALSE, 'active'),
(4, 2, 4, 'Personal Portfolio & Project Website', 'Clean, responsive personal portfolio built with modern HTML/CSS/JS, optimized for recruiters.', 1499.00, 'From ₹1,499', '3-4 days', 'Available', FALSE, 'active'),
(5, 2, 8, 'Data Structures & C++/Java Debugging Help', 'One-on-one debugging sessions, code review, and algorithmic concept breakdowns.', 399.00, '₹399 / hr', 'Same day', 'Available', FALSE, 'active')
ON DUPLICATE KEY UPDATE 
  title = VALUES(title),
  description = VALUES(description),
  price = VALUES(price),
  price_display = VALUES(price_display),
  delivery_time = VALUES(delivery_time),
  badge = VALUES(badge),
  status = VALUES(status);

-- 4. Insert Sample Orders
INSERT INTO orders (id, order_number, service_id, consumer_id, producer_id, status, price, requirements) VALUES
(1, 'SKO-849201', 3, 4, 1, 'completed', 349.00, 'Need a poster for the IEEE Robotics club hackathon with cyber theme.'),
(2, 'SKO-920412', 2, 4, 3, 'in_progress', 499.00, 'Please edit 30s campus vlog reel with upbeat background music.'),
(3, 'SKO-104928', 5, 4, 2, 'pending', 399.00, 'Need help debugging dynamic programming assignment before Friday.')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  requirements = VALUES(requirements);

-- 5. Insert Sample Review for Completed Order
INSERT INTO reviews (id, order_id, service_id, consumer_id, rating, comment) VALUES
(1, 1, 3, 4, 5, 'Super creative and delivered in under 24 hours! Everyone in the club loved the event poster.')
ON DUPLICATE KEY UPDATE
  rating = VALUES(rating),
  comment = VALUES(comment);

-- 6. Insert Sample Notification
INSERT INTO notifications (id, user_id, title, message, type, link) VALUES
(1, 4, 'Order Completed', 'Your order SKO-849201 for Club Poster Design is completed. Leave a review!', 'order_status', 'consumer-dashboard.html?tab=orders'),
(2, 1, 'New Order Received', 'Rohan V. placed a new order SKO-849201 for your poster design service.', 'order_placed', 'producer-dashboard.html?tab=orders')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  message = VALUES(message);

-- 7. Insert Sample Order Message (Phase 9)
INSERT INTO messages (id, order_id, sender_id, receiver_id, message) VALUES
(1, 2, 4, 3, 'Hey Ananya, just shared the raw footage clips on Google Drive!'),
(2, 2, 3, 4, 'Received! Reviewing the pacing and will have the initial draft cut ready by tonight.')
ON DUPLICATE KEY UPDATE
  message = VALUES(message);

-- 8. Insert Sample Platform Report (Phase 10)
INSERT INTO reports (id, reporter_id, service_id, reason, details, status) VALUES
(1, 4, 1, 'Sample listing question', 'Verifying if this listing is live or an example mockup.', 'resolved')
ON DUPLICATE KEY UPDATE
  status = VALUES(status);


