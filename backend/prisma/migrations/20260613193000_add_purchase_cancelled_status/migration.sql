ALTER TABLE `PurchaseOrder` MODIFY `status` ENUM('Draft', 'Confirmed', 'Partially_Received', 'Fully_Received', 'Cancelled') NOT NULL DEFAULT 'Draft';
