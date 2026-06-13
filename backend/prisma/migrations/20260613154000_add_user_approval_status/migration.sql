ALTER TABLE `User`
  MODIFY `status` ENUM('Active', 'Pending', 'Rejected', 'Inactive') NOT NULL DEFAULT 'Active';
