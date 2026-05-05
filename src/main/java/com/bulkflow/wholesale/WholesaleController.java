package com.bulkflow.wholesale;

import static com.bulkflow.wholesale.ApiModels.AdminProductRequest;
import static com.bulkflow.wholesale.ApiModels.AppState;
import static com.bulkflow.wholesale.ApiModels.CheckoutRequest;
import static com.bulkflow.wholesale.ApiModels.CreditRequest;
import static com.bulkflow.wholesale.ApiModels.Invoice;
import static com.bulkflow.wholesale.ApiModels.QuantityRequest;
import static com.bulkflow.wholesale.ApiModels.RegistrationRequest;
import static com.bulkflow.wholesale.ApiModels.RfqResponse;

import jakarta.validation.Valid;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class WholesaleController {
  private final WholesaleService service;

  public WholesaleController(WholesaleService service) {
    this.service = service;
  }

  @GetMapping("/state")
  public AppState state(@RequestParam(defaultValue = "credit") String paymentTerms) {
    return service.state(paymentTerms);
  }

  @PostMapping("/register")
  public AppState register(@Valid @RequestBody RegistrationRequest request) {
    return service.register(request);
  }

  @PostMapping("/approve")
  public AppState approveBuyer() {
    return service.approveBuyer();
  }

  @PostMapping("/credit")
  public AppState saveCredit(@Valid @RequestBody CreditRequest request) {
    return service.saveCredit(request);
  }

  @PostMapping("/cart/quantity")
  public AppState setQuantity(@Valid @RequestBody QuantityRequest request) {
    return service.setQuantity(request);
  }

  @PostMapping("/cart/reorder")
  public AppState reorder() {
    return service.reorder();
  }

  @PostMapping("/cart/upload")
  public AppState bulkUpload(@RequestParam("file") MultipartFile file) throws IOException {
    return service.bulkUpload(file);
  }

  @PutMapping("/products")
  public AppState updateProduct(@Valid @RequestBody AdminProductRequest request) {
    return service.updateProduct(request);
  }

  @PostMapping("/checkout")
  public Invoice checkout(@Valid @RequestBody CheckoutRequest request) {
    return service.checkout(request);
  }

  @PostMapping("/rfq")
  public RfqResponse requestQuote() {
    return new RfqResponse(service.requestQuote());
  }

  @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
  public ResponseEntity<Map<String, String>> badRequest(RuntimeException ex) {
    return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> validationError(MethodArgumentNotValidException ex) {
    String message =
        ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(error -> error.getField() + " " + error.getDefaultMessage())
            .orElse("Invalid request.");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }
}
