//Original source
//https://github.com/DovetailSoftware/tika-lambda
//Modified by Hunter Herman
package com.dovetailsoftware.aws.lambda;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.io.DataOutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.net.URL;
import java.net.URLDecoder;
import java.net.HttpURLConnection;
import java.util.Iterator;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.sax.SAXTransformerFactory;
import javax.xml.transform.sax.TransformerHandler;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.TransformerConfigurationException;
import org.xml.sax.SAXException;

import org.apache.commons.lang.StringEscapeUtils;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.Parser;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.S3Event;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.event.S3EventNotification.S3EventNotificationRecord;
import com.amazonaws.services.s3.model.GetObjectRequest;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.S3Object;

import org.json.simple.JSONObject;

public class TikaLambdaHandler implements RequestHandler<S3Event, String> {

    private LambdaLogger _logger;

    public String handleRequest(S3Event s3event, Context context) {
        _logger = context.getLogger();
        _logger.log("Received S3 Event: " + s3event.toJson());

        try {
            S3EventNotificationRecord record = s3event.getRecords().get(0);

            String bucket = record.getS3().getBucket().getName();
            String extractBucket = "extracts." + bucket;

            // Object key may have spaces or unicode non-ASCII characters.
            String key = URLDecoder.decode(record.getS3().getObject().getKey().replace('+', ' '), "UTF-8");

            // Short-circuit ignore .extract files because they have already been extracted, this prevents an endless loop
            if (key.toLowerCase().endsWith(".extract")) {
              _logger.log("Ignoring extract file " + key);
              return "Ignored";
            }

            AmazonS3 s3Client = new AmazonS3Client();
            S3Object s3Object = s3Client.getObject(new GetObjectRequest(bucket, key));

            try (InputStream objectData = s3Object.getObjectContent()) {
                String extractJson = doTikaStuff(bucket, key, objectData);

                byte[] extractBytes = extractJson.getBytes(Charset.forName("UTF-8"));
                int extractLength = extractBytes.length;

                ObjectMetadata metaData = new ObjectMetadata();
                metaData.setContentLength(extractLength);

                InputStream inputStream = new ByteArrayInputStream(extractBytes);

                String elasticSearchURL = "http://search-dev-task-search-cluster-ric5clhuvao44dtnhhhlnje7o4.us-west-2.es.amazonaws.com/files/file";
                String result = executePost(elasticSearchURL,extractJson); 
            }
        } catch (IOException | TransformerConfigurationException | SAXException e) {
            _logger.log("Exception: " + e.getLocalizedMessage());
            throw new RuntimeException(e);
        }
        return "Success";
    }

    //Original Source:
    //http://stackoverflow.com/questions/1359689/how-to-send-http-request-in-java
    private String executePost(String targetURL, String documentData) {
            HttpURLConnection connection = null;
            try {
                    URL url = new URL(targetURL);
                    connection = (HttpURLConnection)url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setUseCaches(false);
                    connection.setDoOutput(true);

                    DataOutputStream wr = new DataOutputStream (
                        connection.getOutputStream());
                    wr.writeBytes(documentData);
                    wr.close();

                    InputStream is = connection.getInputStream();
                    BufferedReader rd = new BufferedReader(new InputStreamReader(is));
                    StringBuilder response = new StringBuilder(); // or StringBuffer if not Java 5+ 
                    String line;
                    while((line = rd.readLine()) != null) {
                      response.append(line);
                      response.append('\r');
                    }
                    rd.close();
                    return response.toString();
                  } catch (Exception e) {
                    e.printStackTrace();
                    _logger.log("\nTarget URL: " + targetURL);
                    _logger.log("\nParsed file contents: " + documentData);
                    return null;
                  } finally {
                    if(connection != null) {
                      connection.disconnect(); 
                    }
                  }
            }

    private String doTikaStuff(String bucket, String key, InputStream objectData) throws IOException, TransformerConfigurationException, SAXException {
      _logger.log("Extracting text with Tika");
      String extractedText = "";

      SAXTransformerFactory factory = (SAXTransformerFactory)SAXTransformerFactory.newInstance();
      TransformerHandler handler = factory.newTransformerHandler();
      handler.getTransformer().setOutputProperty(OutputKeys.METHOD, "text");
      handler.getTransformer().setOutputProperty(OutputKeys.INDENT, "yes");
      StringWriter sw = new StringWriter();
      handler.setResult(new StreamResult(sw));
      AutoDetectParser parser = new AutoDetectParser();
      ParseContext parseContext = new ParseContext();
      parseContext.set(Parser.class, parser);

      Tika tika = new Tika();
      Metadata tikaMetadata = new Metadata();
      try {
        // for synthetic transactions
        if( key.toLowerCase().endsWith("tika.exception.testing.pdf")) {
          throw new TikaException("Test Tika Exception");
        }
        parser.parse(objectData, handler, tikaMetadata, parseContext);
        extractedText = sw.toString();
      } catch( TikaException e) {
        _logger.log("TikaException thrown while parsing: " + e.getLocalizedMessage());
        return assembleExceptionResult(bucket, key, e);
      }
      _logger.log("Tika parsing success");
      return assembleExtractionResult(bucket, key, extractedText, tikaMetadata);
    }

    private String assembleExtractionResult(String bucket, String key, String extractedText, Metadata tikaMetadata) {

      JSONObject extractJson = new JSONObject();

      String cleanText = StringEscapeUtils.escapeHtml(extractedText).replaceAll("\\s+"," ");

      String contentType = tikaMetadata.get("Content-Type");
      contentType = contentType != null ? contentType : "content/unknown";

      String contentLength = tikaMetadata.get("Content-Length");
      contentLength = contentLength != null ? contentLength : "0";

      extractJson.put("Exception", null);
      extractJson.put("Bucket", bucket);
      extractJson.put("Key",key);
      extractJson.put("Text", cleanText);

      return extractJson.toJSONString();
    }

    private String assembleExceptionResult(String bucket, String key, Exception e){
      JSONObject exceptionJson = new JSONObject();

      exceptionJson.put("Exception", e.getLocalizedMessage());
      exceptionJson.put("FilePath", "s3://" + bucket + "/" + key);
      exceptionJson.put("ContentType", "unknown");
      exceptionJson.put("ContentLength", "0");
      exceptionJson.put("Text", "");

      JSONObject metadataJson = new JSONObject();
      metadataJson.put("resourceName", "s3://" + bucket + "/" + key);

      exceptionJson.put("Metadata", metadataJson);

      return exceptionJson.toJSONString();
    }
}
