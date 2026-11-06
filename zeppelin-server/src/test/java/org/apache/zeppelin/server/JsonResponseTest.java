/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.zeppelin.server;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.apache.zeppelin.display.Input;
import org.apache.zeppelin.display.ui.OptionInput.ParamOption;
import org.apache.zeppelin.display.ui.Select;
import org.junit.jupiter.api.Test;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.ws.rs.core.Response;

class JsonResponseTest {
  private static class FormSettings {
    private final Map<String, Input<?>> forms = Map.of(
        "period", new Select("period", 7, new ParamOption[] {
            new ParamOption(7, "Week"), new ParamOption(30, "Month")
        }));
  }

  @Test
  void preservesNativeFormTypeAndTypedValuesForRestConsumers() {
    String json = new JsonResponse<>(Response.Status.OK, new FormSettings()).toString();
    JsonObject form = JsonParser.parseString(json).getAsJsonObject()
        .getAsJsonObject("body").getAsJsonObject("forms").getAsJsonObject("period");
    assertEquals("Select", form.get("type").getAsString());
    assertEquals(7, form.get("defaultValue").getAsInt());
    assertEquals(30, form.getAsJsonArray("options").get(1).getAsJsonObject()
        .get("value").getAsInt());
  }
}
