-- Sample Oracle DDL for Customer Management System

-- Customers table
CREATE TABLE CUSTOMERS (
    CUSTOMER_ID NUMBER(10) NOT NULL,
    CUSTOMER_NAME VARCHAR2(100) NOT NULL,
    EMAIL VARCHAR2(100),
    PHONE VARCHAR2(20),
    ADDRESS VARCHAR2(200),
    CITY VARCHAR2(50),
    STATE VARCHAR2(2),
    ZIP_CODE VARCHAR2(10),
    BALANCE NUMBER(12,2) DEFAULT 0.00,
    CREDIT_LIMIT NUMBER(12,2) DEFAULT 5000.00,
    STATUS CHAR(1) DEFAULT 'A',
    CREATED_DATE DATE DEFAULT SYSDATE,
    UPDATED_DATE DATE,
    CONSTRAINT pk_customers PRIMARY KEY (CUSTOMER_ID),
    CONSTRAINT chk_status CHECK (STATUS IN ('A', 'I', 'S'))
);

-- Orders table
CREATE TABLE ORDERS (
    ORDER_ID NUMBER(12) NOT NULL,
    CUSTOMER_ID NUMBER(10) NOT NULL,
    ORDER_DATE DATE DEFAULT SYSDATE,
    ORDER_STATUS VARCHAR2(20) DEFAULT 'PENDING',
    SUBTOTAL NUMBER(12,2),
    TAX_AMOUNT NUMBER(12,2),
    SHIPPING_COST NUMBER(10,2),
    TOTAL_AMOUNT NUMBER(12,2),
    PAYMENT_METHOD VARCHAR2(20),
    NOTES CLOB,
    CONSTRAINT pk_orders PRIMARY KEY (ORDER_ID),
    CONSTRAINT fk_orders_customer FOREIGN KEY (CUSTOMER_ID)
        REFERENCES CUSTOMERS (CUSTOMER_ID)
);

-- Order Items table
CREATE TABLE ORDER_ITEMS (
    ORDER_ITEM_ID NUMBER(15) NOT NULL,
    ORDER_ID NUMBER(12) NOT NULL,
    PRODUCT_ID NUMBER(10) NOT NULL,
    QUANTITY NUMBER(6) NOT NULL,
    UNIT_PRICE NUMBER(10,2) NOT NULL,
    DISCOUNT_PCT NUMBER(5,2) DEFAULT 0.00,
    LINE_TOTAL NUMBER(12,2),
    CONSTRAINT pk_order_items PRIMARY KEY (ORDER_ITEM_ID),
    CONSTRAINT fk_order_items_order FOREIGN KEY (ORDER_ID)
        REFERENCES ORDERS (ORDER_ID),
    CONSTRAINT fk_order_items_product FOREIGN KEY (PRODUCT_ID)
        REFERENCES PRODUCTS (PRODUCT_ID)
);

-- Products table
CREATE TABLE PRODUCTS (
    PRODUCT_ID NUMBER(10) NOT NULL,
    PRODUCT_CODE VARCHAR2(50) NOT NULL,
    PRODUCT_NAME VARCHAR2(200) NOT NULL,
    DESCRIPTION CLOB,
    CATEGORY VARCHAR2(50),
    UNIT_PRICE NUMBER(10,2) NOT NULL,
    COST_PRICE NUMBER(10,2),
    STOCK_QUANTITY NUMBER(10) DEFAULT 0,
    REORDER_LEVEL NUMBER(10) DEFAULT 10,
    ACTIVE CHAR(1) DEFAULT 'Y',
    CREATED_DATE DATE DEFAULT SYSDATE,
    CONSTRAINT pk_products PRIMARY KEY (PRODUCT_ID),
    CONSTRAINT uk_product_code UNIQUE (PRODUCT_CODE)
);

-- Transactions table
CREATE TABLE TRANSACTIONS (
    TRANSACTION_ID NUMBER(15) NOT NULL,
    CUSTOMER_ID NUMBER(10) NOT NULL,
    TRANSACTION_TYPE VARCHAR2(2) NOT NULL,
    TRANSACTION_DATE DATE DEFAULT SYSDATE,
    AMOUNT NUMBER(12,2) NOT NULL,
    REFERENCE_ID NUMBER(12),
    DESCRIPTION VARCHAR2(200),
    STATUS VARCHAR2(20) DEFAULT 'COMPLETED',
    CONSTRAINT pk_transactions PRIMARY KEY (TRANSACTION_ID),
    CONSTRAINT fk_trans_customer FOREIGN KEY (CUSTOMER_ID)
        REFERENCES CUSTOMERS (CUSTOMER_ID),
    CONSTRAINT chk_trans_type CHECK (TRANSACTION_TYPE IN ('CR', 'DB', 'AD'))
);

-- Audit Log table
CREATE TABLE AUDIT_LOG (
    AUDIT_ID NUMBER(18) NOT NULL,
    TABLE_NAME VARCHAR2(50) NOT NULL,
    RECORD_ID NUMBER(15) NOT NULL,
    ACTION VARCHAR2(10) NOT NULL,
    OLD_VALUES CLOB,
    NEW_VALUES CLOB,
    CHANGED_BY VARCHAR2(50),
    CHANGED_DATE DATE DEFAULT SYSDATE,
    CONSTRAINT pk_audit_log PRIMARY KEY (AUDIT_ID)
);

-- Create indexes
CREATE INDEX idx_customers_email ON CUSTOMERS (EMAIL);
CREATE INDEX idx_customers_name ON CUSTOMERS (CUSTOMER_NAME);
CREATE INDEX idx_orders_customer ON ORDERS (CUSTOMER_ID);
CREATE INDEX idx_orders_date ON ORDERS (ORDER_DATE);
CREATE INDEX idx_order_items_order ON ORDER_ITEMS (ORDER_ID);
CREATE INDEX idx_order_items_product ON ORDER_ITEMS (PRODUCT_ID);
CREATE INDEX idx_products_category ON PRODUCTS (CATEGORY);
CREATE INDEX idx_transactions_customer ON TRANSACTIONS (CUSTOMER_ID);
CREATE INDEX idx_transactions_date ON TRANSACTIONS (TRANSACTION_DATE);

-- Create sequences
CREATE SEQUENCE seq_customer_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE seq_order_id START WITH 100000 INCREMENT BY 1;
CREATE SEQUENCE seq_order_item_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_product_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE seq_transaction_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_audit_id START WITH 1 INCREMENT BY 1;

-- Create view for customer orders
CREATE OR REPLACE VIEW vw_customer_orders AS
SELECT
    c.customer_id,
    c.customer_name,
    o.order_id,
    o.order_date,
    o.total_amount,
    o.order_status
FROM
    customers c
    INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE
    c.status = 'A';

-- Create view for product inventory
CREATE OR REPLACE VIEW vw_product_inventory AS
SELECT
    product_id,
    product_code,
    product_name,
    stock_quantity,
    reorder_level,
    CASE
        WHEN stock_quantity <= reorder_level THEN 'LOW'
        WHEN stock_quantity <= reorder_level * 2 THEN 'MEDIUM'
        ELSE 'OK'
    END AS stock_status
FROM
    products
WHERE
    active = 'Y';

-- Create stored procedure to calculate customer balance
CREATE OR REPLACE PROCEDURE sp_update_customer_balance (
    p_customer_id IN NUMBER,
    p_amount IN NUMBER,
    p_transaction_type IN VARCHAR2
) AS
    v_current_balance NUMBER(12,2);
BEGIN
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM customers
    WHERE customer_id = p_customer_id
    FOR UPDATE;

    -- Update balance based on transaction type
    IF p_transaction_type = 'CR' THEN
        v_current_balance := v_current_balance + p_amount;
    ELSIF p_transaction_type = 'DB' THEN
        v_current_balance := v_current_balance - p_amount;
    END IF;

    -- Update customer record
    UPDATE customers
    SET balance = v_current_balance,
        updated_date = SYSDATE
    WHERE customer_id = p_customer_id;

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- Create trigger for audit logging
CREATE OR REPLACE TRIGGER trg_customers_audit
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW
DECLARE
    v_action VARCHAR2(10);
BEGIN
    IF INSERTING THEN
        v_action := 'INSERT';
    ELSIF UPDATING THEN
        v_action := 'UPDATE';
    ELSIF DELETING THEN
        v_action := 'DELETE';
    END IF;

    INSERT INTO audit_log (
        audit_id,
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_by,
        changed_date
    ) VALUES (
        seq_audit_id.NEXTVAL,
        'CUSTOMERS',
        NVL(:NEW.customer_id, :OLD.customer_id),
        v_action,
        NULL, -- Would include JSON of old values
        NULL, -- Would include JSON of new values
        USER,
        SYSDATE
    );
END;
/

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION fn_calculate_order_total (
    p_order_id IN NUMBER
) RETURN NUMBER AS
    v_total NUMBER(12,2) := 0;
BEGIN
    SELECT SUM(line_total)
    INTO v_total
    FROM order_items
    WHERE order_id = p_order_id;

    RETURN NVL(v_total, 0);
END;
/
