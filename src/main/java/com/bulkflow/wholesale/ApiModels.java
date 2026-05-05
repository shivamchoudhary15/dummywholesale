package com.bulkflow.wholesale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class ApiModels {
  private ApiModels() {}

  public record Buyer(
      String businessName,
      String taxId,
      String email,
      boolean approved,
      BigDecimal requestedCredit,
      BigDecimal creditLimit,
      BigDecimal amountDue) {}

  public record Tier(int min, BigDecimal price) {}

  public record Product(
      String sku,
      String name,
      String category,
      int moq,
      int stock,
      List<Tier> tiers) {}

  public record CartLine(Product product, int quantity, BigDecimal unitPrice, BigDecimal lineTotal) {}

  public record OrderValidation(
      List<CartLine> lines,
      BigDecimal subtotal,
      BigDecimal tax,
      BigDecimal shipping,
      BigDecimal total,
      List<String> problems) {}

  public record SalesOrder(
      String id,
      String buyer,
      BigDecimal total,
      String status,
      String terms) {}

  public record Invoice(
      String id,
      LocalDate date,
      Buyer buyer,
      String shippingCity,
      String terms,
      List<CartLine> lines,
      BigDecimal subtotal,
      BigDecimal tax,
      BigDecimal shipping,
      BigDecimal total) {}

  public record AppState(
      Buyer buyer,
      List<Product> products,
      Map<String, Integer> cart,
      List<SalesOrder> orders,
      Invoice latestInvoice,
      OrderValidation validation) {}

  public record RegistrationRequest(
      @NotBlank String businessName,
      @NotBlank String taxId,
      @Email @NotBlank String email,
      @Min(0) BigDecimal requestedCredit) {}

  public record CreditRequest(@Min(0) BigDecimal creditLimit, @Min(0) BigDecimal amountDue) {}

  public record QuantityRequest(@NotBlank String sku, @Min(0) int quantity) {}

  public record AdminProductRequest(
      @NotBlank String sku,
      @Min(1) int moq,
      @Min(0) int stock,
      @NotEmpty List<@Min(0) BigDecimal> prices) {}

  public record CheckoutRequest(@NotBlank String paymentTerms, @NotBlank String shippingCity) {}

  public record RfqResponse(String message) {}
}
