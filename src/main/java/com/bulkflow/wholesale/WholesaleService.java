package com.bulkflow.wholesale;

import static com.bulkflow.wholesale.ApiModels.AdminProductRequest;
import static com.bulkflow.wholesale.ApiModels.AppState;
import static com.bulkflow.wholesale.ApiModels.Buyer;
import static com.bulkflow.wholesale.ApiModels.CartLine;
import static com.bulkflow.wholesale.ApiModels.CheckoutRequest;
import static com.bulkflow.wholesale.ApiModels.CreditRequest;
import static com.bulkflow.wholesale.ApiModels.Invoice;
import static com.bulkflow.wholesale.ApiModels.OrderValidation;
import static com.bulkflow.wholesale.ApiModels.Product;
import static com.bulkflow.wholesale.ApiModels.QuantityRequest;
import static com.bulkflow.wholesale.ApiModels.RegistrationRequest;
import static com.bulkflow.wholesale.ApiModels.SalesOrder;
import static com.bulkflow.wholesale.ApiModels.Tier;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class WholesaleService {
  private static final BigDecimal TAX_RATE = new BigDecimal("0.18");
  private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("250000");
  private static final BigDecimal SHIPPING_FEE = new BigDecimal("2400");

  private Buyer buyer =
      new Buyer(
          "Metro Fresh Retail LLP",
          "27AAHCM9988Q1Z5",
          "purchasing@metrofresh.example",
          false,
          new BigDecimal("350000"),
          new BigDecimal("300000"),
          new BigDecimal("84500"));

  private final List<Product> products = new ArrayList<>();
  private final Map<String, Integer> cart = new LinkedHashMap<>();
  private final List<SalesOrder> orders = new ArrayList<>();
  private Invoice latestInvoice;

  public WholesaleService() {
    products.add(product("RICE-25-BAS", "Premium Basmati Rice 25 kg", "Staples", 40, 2800, 1480, 1410, 1355));
    products.add(product("OIL-15-SUN", "Sunflower Oil 15 L Tin", "Edible oils", 30, 1180, 1725, 1650, 1588));
    products.add(product("DET-10-LIQ", "Liquid Detergent 10 L Can", "Home care", 50, 3400, 820, 775, 730));
    products.add(product("BIS-24-GLU", "Glucose Biscuit Carton 24 pk", "Packaged foods", 80, 5200, 510, 480, 452));
    products.add(product("SOAP-72-ANT", "Antibacterial Soap Master Carton", "Personal care", 60, 2400, 960, 908, 870));

    orders.add(new SalesOrder("SO-1028", buyer.businessName(), new BigDecimal("184260"), "Packed", "Credit / Net 30"));
    orders.add(new SalesOrder("SO-1021", "City Basket Stores", new BigDecimal("92740"), "Dispatched", "Pay now"));
  }

  public synchronized AppState state(String paymentTerms) {
    return new AppState(buyer, List.copyOf(products), Map.copyOf(cart), List.copyOf(orders), latestInvoice, validate(paymentTerms));
  }

  public synchronized AppState register(RegistrationRequest request) {
    buyer =
        new Buyer(
            request.businessName(),
            request.taxId(),
            request.email(),
            false,
            request.requestedCredit(),
            buyer.creditLimit(),
            buyer.amountDue());
    return state("credit");
  }

  public synchronized AppState approveBuyer() {
    buyer =
        new Buyer(
            buyer.businessName(),
            buyer.taxId(),
            buyer.email(),
            true,
            buyer.requestedCredit(),
            buyer.creditLimit(),
            buyer.amountDue());
    return state("credit");
  }

  public synchronized AppState saveCredit(CreditRequest request) {
    buyer =
        new Buyer(
            buyer.businessName(),
            buyer.taxId(),
            buyer.email(),
            buyer.approved(),
            buyer.requestedCredit(),
            request.creditLimit(),
            request.amountDue());
    return state("credit");
  }

  public synchronized AppState setQuantity(QuantityRequest request) {
    requireProduct(request.sku());
    if (request.quantity() == 0) {
      cart.remove(request.sku());
    } else {
      cart.put(request.sku(), request.quantity());
    }
    return state("credit");
  }

  public synchronized AppState reorder() {
    cart.clear();
    cart.put("RICE-25-BAS", 120);
    cart.put("OIL-15-SUN", 90);
    cart.put("DET-10-LIQ", 130);
    cart.put("BIS-24-GLU", 240);
    return state("credit");
  }

  public synchronized AppState bulkUpload(MultipartFile file) throws IOException {
    String csv = new String(file.getBytes());
    CSVParser parser =
        CSVParser.parse(
            new StringReader(csv),
            CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build());

    parser.forEach(
        row -> {
          String sku = row.get("sku");
          int quantity = Integer.parseInt(row.get("quantity"));
          if (findProduct(sku) != null && quantity > 0) {
            cart.put(sku, quantity);
          }
        });
    return state("credit");
  }

  public synchronized AppState updateProduct(AdminProductRequest request) {
    Product product = requireProduct(request.sku());
    List<BigDecimal> prices = request.prices();
    if (prices.size() < 3) {
      throw new IllegalArgumentException("Three prices are required for base, 100+, and 500+ tiers.");
    }

    products.remove(product);
    products.add(
        new Product(
            product.sku(),
            product.name(),
            product.category(),
            request.moq(),
            request.stock(),
            List.of(
                new Tier(1, prices.get(0)),
                new Tier(100, prices.get(1)),
                new Tier(500, prices.get(2)))));
    products.sort(Comparator.comparing(Product::sku));
    return state("credit");
  }

  public synchronized Invoice checkout(CheckoutRequest request) {
    OrderValidation validation = validate(request.paymentTerms());
    if (!validation.problems().isEmpty()) {
      throw new IllegalStateException(String.join(" ", validation.problems()));
    }

    String invoiceId = "INV-%d-%04d".formatted(LocalDate.now().getYear(), orders.size() + 1001);
    latestInvoice =
        new Invoice(
            invoiceId,
            LocalDate.now(),
            buyer,
            request.shippingCity(),
            "credit".equals(request.paymentTerms()) ? "Credit / Net 30" : "Pay now",
            validation.lines(),
            validation.subtotal(),
            validation.tax(),
            validation.shipping(),
            validation.total());

    if ("credit".equals(request.paymentTerms())) {
      buyer =
          new Buyer(
              buyer.businessName(),
              buyer.taxId(),
              buyer.email(),
              buyer.approved(),
              buyer.requestedCredit(),
              buyer.creditLimit(),
              buyer.amountDue().add(validation.total()));
    }

    orders.add(
        0,
        new SalesOrder(
            invoiceId.replace("INV", "SO"),
            buyer.businessName(),
            validation.total(),
            "Invoice generated",
            latestInvoice.terms()));
    cart.clear();
    return latestInvoice;
  }

  public synchronized String requestQuote() {
    CartLine largestLine =
        buildLines().stream()
            .max(Comparator.comparing(CartLine::quantity))
            .orElseThrow(() -> new IllegalStateException("Add high-volume SKUs before requesting a quote."));
    return "RFQ drafted for %s at %d units. Seller can counter from the admin pricing engine."
        .formatted(largestLine.product().sku(), largestLine.quantity());
  }

  private OrderValidation validate(String paymentTerms) {
    List<CartLine> lines = buildLines();
    BigDecimal subtotal =
        lines.stream().map(CartLine::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
    BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
    BigDecimal shipping =
        subtotal.compareTo(BigDecimal.ZERO) == 0 || subtotal.compareTo(FREE_SHIPPING_THRESHOLD) > 0
            ? BigDecimal.ZERO
            : SHIPPING_FEE;
    BigDecimal total = subtotal.add(tax).add(shipping).setScale(2, RoundingMode.HALF_UP);
    List<String> problems = new ArrayList<>();

    if (!buyer.approved()) {
      problems.add("Buyer approval is required before wholesale prices and checkout are available.");
    }

    if (lines.isEmpty()) {
      problems.add("Add at least one SKU to create a bulk order.");
    }

    for (CartLine line : lines) {
      if (line.quantity() < line.product().moq()) {
        problems.add("%s needs MOQ %d; current quantity is %d.".formatted(line.product().sku(), line.product().moq(), line.quantity()));
      }
      if (line.quantity() > line.product().stock()) {
        problems.add("%s exceeds available stock of %d.".formatted(line.product().sku(), line.product().stock()));
      }
    }

    if ("credit".equals(paymentTerms)) {
      BigDecimal projectedDue = buyer.amountDue().add(total);
      if (projectedDue.compareTo(buyer.creditLimit()) > 0) {
        problems.add("Credit limit exceeded by %s.".formatted(projectedDue.subtract(buyer.creditLimit())));
      }
    }

    return new OrderValidation(lines, subtotal, tax, shipping, total, problems);
  }

  private List<CartLine> buildLines() {
    return cart.entrySet().stream()
        .map(entry -> buildLine(entry.getKey(), entry.getValue()))
        .toList();
  }

  private CartLine buildLine(String sku, int quantity) {
    Product product = requireProduct(sku);
    BigDecimal unitPrice = unitPrice(product, quantity);
    return new CartLine(product, quantity, unitPrice, unitPrice.multiply(BigDecimal.valueOf(quantity)));
  }

  private BigDecimal unitPrice(Product product, int quantity) {
    BigDecimal price = product.tiers().get(0).price();
    for (Tier tier : product.tiers()) {
      if (quantity >= tier.min()) {
        price = tier.price();
      }
    }
    return price;
  }

  private Product requireProduct(String sku) {
    Product product = findProduct(sku);
    if (product == null) {
      throw new IllegalArgumentException("Unknown SKU: " + sku);
    }
    return product;
  }

  private Product findProduct(String sku) {
    return products.stream().filter(product -> product.sku().equals(sku)).findFirst().orElse(null);
  }

  private Product product(String sku, String name, String category, int moq, int stock, int base, int hundred, int fiveHundred) {
    return new Product(
        sku,
        name,
        category,
        moq,
        stock,
        List.of(
            new Tier(1, BigDecimal.valueOf(base)),
            new Tier(100, BigDecimal.valueOf(hundred)),
            new Tier(500, BigDecimal.valueOf(fiveHundred))));
  }
}
